import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhone, phonesMatch } from '@/lib/whatsapp/phone-utils';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';

// Helper to instantiate supabase admin client
let _adminClient: any = null;
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _adminClient;
}

// Enable CORS for external/public form submissions
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: formId } = await params;
    const { submitted_values } = await req.json();

    if (!formId) {
      return NextResponse.json(
        { error: 'Missing form ID' },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (!submitted_values || typeof submitted_values !== 'object') {
      return NextResponse.json(
        { error: 'Missing submitted_values object' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const supabase = supabaseAdmin();

    // 1. Fetch form configuration
    const { data: form, error: formError } = await supabase
      .from('custom_forms')
      .select('*')
      .eq('id', formId)
      .eq('is_active', true)
      .maybeSingle();

    if (formError || !form) {
      return NextResponse.json(
        { error: 'Form not found or inactive' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // 2. Fetch form fields
    const { data: fields, error: fieldsError } = await supabase
      .from('custom_form_fields')
      .select('*')
      .eq('form_id', formId)
      .order('position', { ascending: true });

    if (fieldsError || !fields) {
      return NextResponse.json(
        { error: 'Failed to retrieve form fields' },
        { status: 500, headers: corsHeaders() }
      );
    }

    // 3. Resolve Workspace User Owner/Member to attribute contact/deal creation to
    const { data: ownerMember } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', form.workspace_id)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle();

    let creatorUserId = ownerMember?.user_id;

    if (!creatorUserId) {
      const { data: anyMember } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', form.workspace_id)
        .limit(1)
        .maybeSingle();
      creatorUserId = anyMember?.user_id;
    }

    if (!creatorUserId) {
      return NextResponse.json(
        { error: 'No active workspace owner or member found' },
        { status: 500, headers: corsHeaders() }
      );
    }

    // 4. Map form submissions to CRM fields
    const contactData: Record<string, string> = {
      name: '',
      phone: '',
      email: '',
      company: '',
    };
    const contactCustomValues: Record<string, string> = {};
    const dealData: Record<string, string> = {
      title: '',
      value: '',
      notes: '',
      expected_close_date: '',
    };

    for (const field of fields) {
      // Find submitted value by field id or fallback to label
      const val = submitted_values[field.id] !== undefined
        ? submitted_values[field.id]
        : submitted_values[field.label];

      if (val === undefined || val === null) continue;

      // Handle boolean or array types (e.g. multi-select) as strings for standard fields
      const strVal = Array.isArray(val)
        ? val.join(', ')
        : typeof val === 'boolean'
          ? (val ? 'Yes' : 'No')
          : String(val).trim();

      if (field.mapping_type === 'contact_field' && field.mapping_key) {
        contactData[field.mapping_key] = strVal;
      } else if (field.mapping_type === 'contact_custom_field' && field.mapping_key) {
        contactCustomValues[field.mapping_key] = strVal;
      } else if (field.mapping_type === 'deal_field' && field.mapping_key) {
        dealData[field.mapping_key] = strVal;
      }
    }

    // Ensure phone number exists (required in CRM contacts table). Generate fallback placeholder if not submitted.
    if (!contactData.phone) {
      if (contactData.email) {
        const cleanEmailPrefix = contactData.email.split('@')[0].replace(/\D/g, '');
        contactData.phone = cleanEmailPrefix ? cleanEmailPrefix.slice(-10) : '0000000000';
      } else {
        // Random 10 digit number
        contactData.phone = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      }
    }

    // 5. Contact Deduplication and Insertion
    // Fetch all contacts in the workspace to perform phonesMatch
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('workspace_id', form.workspace_id);

    let contactId = '';
    let existingContact = contacts?.find((c: any) => phonesMatch(c.phone, contactData.phone));

    // If no match found by phone, search by email (if email was provided)
    if (!existingContact && contactData.email) {
      const { data: matchedByEmail } = await supabase
        .from('contacts')
        .select('*')
        .eq('workspace_id', form.workspace_id)
        .eq('email', contactData.email)
        .limit(1)
        .maybeSingle();
      existingContact = matchedByEmail;
    }

    if (existingContact) {
      contactId = existingContact.id;
      // Update fields if they changed and were submitted
      const contactUpdates: Record<string, string> = {};
      if (contactData.name && contactData.name !== existingContact.name) {
        contactUpdates.name = contactData.name;
      }
      if (contactData.email && contactData.email !== existingContact.email) {
        contactUpdates.email = contactData.email;
      }
      if (contactData.company && contactData.company !== existingContact.company) {
        contactUpdates.company = contactData.company;
      }

      if (Object.keys(contactUpdates).length > 0) {
        await supabase
          .from('contacts')
          .update({ ...contactUpdates, updated_at: new Date().toISOString() })
          .eq('id', contactId);
      }
    } else {
      // Create new contact
      const { data: newContact, error: insertError } = await supabase
        .from('contacts')
        .insert({
          user_id: creatorUserId,
          workspace_id: form.workspace_id,
          phone: contactData.phone,
          name: contactData.name || 'Form Lead',
          email: contactData.email || null,
          company: contactData.company || null,
        })
        .select()
        .single();

      if (insertError || !newContact) {
        console.error('[Submit Error] Failed to create contact:', insertError);
        return NextResponse.json(
          { error: 'Failed to create contact record' },
          { status: 500, headers: corsHeaders() }
        );
      }
      contactId = newContact.id;
    }

    // 6. Save Contact Custom Values
    for (const [customFieldId, val] of Object.entries(contactCustomValues)) {
      if (!val) continue;
      await supabase
        .from('contact_custom_values')
        .upsert(
          {
            contact_id: contactId,
            custom_field_id: customFieldId,
            value: val,
          },
          { onConflict: 'contact_id,custom_field_id' }
        );
    }

    // 7. Deal Creation (if pipeline and stage integration are configured)
    let dealId: string | null = null;
    const filesToProcess: { fieldKey: string; fileObj: any; relativePath: string; savedName: string; workspaceName: string; subFolder: string }[] = [];
    const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9 _-]/g, '').trim();

    if (form.pipeline_id && form.stage_id) {
      dealId = crypto.randomUUID();
    }

    let workspaceName = form.workspace_id;
    try {
      const { data: wsData } = await supabase.from('workspaces').select('name').eq('id', form.workspace_id).single();
      if (wsData) {
        workspaceName = sanitize(wsData.name);
      }
    } catch (wsErr) {
      console.error('Failed to fetch workspace name:', wsErr);
    }

    const contactName = contactData.name || (existingContact?.name) || 'Form Lead';
    const dealTitle = dealData.title || `Form Submission: ${contactName}`;
    const subFolder = dealId ? sanitize(dealTitle) : 'Form Submissions';

    const processedValues = { ...submitted_values };

    // Identify file uploads in the submission payload and pre-calculate paths
    for (const [key, value] of Object.entries(submitted_values)) {
      if (typeof value === 'object' && value !== null && 'base64' in value && 'name' in value) {
        const fileObj = value as any;
        const uniqueId = Math.random().toString(36).substring(2, 10);
        const extension = fileObj.name.split('.').pop() || 'bin';
        const sanitizedOriginalName = sanitize(fileObj.name.replace(`.${extension}`, ''));
        const savedName = `${sanitizedOriginalName}_${uniqueId}.${extension}`;
        const relativePath = `/uploads/${workspaceName}/${subFolder}/${savedName}`;

        filesToProcess.push({
          fieldKey: key,
          fileObj,
          relativePath,
          savedName,
          workspaceName,
          subFolder,
        });

        // Swap out the base64 payload with filesystem URL immediately
        processedValues[key] = relativePath;
      }
    }

    if (form.pipeline_id && form.stage_id && dealId) {
      // Compile readable summary of ALL submitted responses to append to deal notes (using processedValues)
      let responsesSummary = '\n\n--- Form Response Details ---\n';
      for (const field of fields) {
        const val = processedValues[field.id] !== undefined
          ? processedValues[field.id]
          : processedValues[field.label];
        if (val !== undefined && val !== null && val !== '') {
          responsesSummary += `${field.label}: ${
            Array.isArray(val)
              ? val.join(', ')
              : typeof val === 'boolean'
                ? (val ? 'Yes' : 'No')
                : val
          }\n`;
        }
      }

      const rawDealValue = parseFloat(dealData.value);
      const dealValue = isNaN(rawDealValue) ? 0 : rawDealValue;
      const finalNotes = (dealData.notes ? `${dealData.notes}\n` : '') + responsesSummary;

      const { data: newDeal, error: dealError } = await supabase
        .from('deals')
        .insert({
          id: dealId,
          user_id: creatorUserId,
          workspace_id: form.workspace_id,
          pipeline_id: form.pipeline_id,
          stage_id: form.stage_id,
          contact_id: contactId,
          title: dealTitle,
          value: dealValue,
          currency: 'USD',
          notes: finalNotes,
          expected_close_date: dealData.expected_close_date || null,
          status: 'open',
        })
        .select()
        .single();

      if (dealError) {
        console.error('[Submit Error] Failed to create deal:', dealError);
        dealId = null;
      }
    }

    // Process file attachments and save (now that the deal is in the DB, FK constraint passes)
    if (filesToProcess.length > 0) {
      for (const item of filesToProcess) {
        try {
          const { fileObj, relativePath, savedName, workspaceName, subFolder } = item;
          const base64Data = fileObj.base64.split(';base64,').pop();
          const buffer = Buffer.from(base64Data, 'base64');

          const uploadDir = join(process.cwd(), 'public', 'uploads', workspaceName, subFolder);
          await mkdir(uploadDir, { recursive: true });

          const filePath = join(uploadDir, savedName);
          await writeFile(filePath, buffer);

          // Insert into media_files table
          const insertData: any = {
            workspace_id: form.workspace_id,
            name: fileObj.name,
            mime_type: fileObj.type,
            file_size: fileObj.size,
            local_path: relativePath,
          };
          if (dealId) {
            insertData.deal_id = dealId;
          }

          const { data: dbFile, error: dbErr } = await supabase
            .from('media_files')
            .insert(insertData)
            .select()
            .single();

          if (dbErr) {
            console.error('[File Save Error] DB insert failed:', dbErr);
          }
        } catch (fileErr) {
          console.error('[File Process Error] Failed to process file:', fileErr);
        }
      }
    }

    // 8. Record Submission history log (using processedValues)
    const { data: submissionRecord, error: subError } = await supabase
      .from('custom_form_submissions')
      .insert({
        form_id: formId,
        contact_id: contactId,
        deal_id: dealId,
        submitted_values: processedValues,
      })
      .select()
      .single();

    if (subError) {
      console.error('[Submit Error] Failed to write submission log:', subError);
    }

    return NextResponse.json(
      {
        success: true,
        submissionId: submissionRecord?.id || null,
        contactId,
        dealId,
      },
      { headers: corsHeaders() }
    );

  } catch (error: any) {
    console.error('[submission api error]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
