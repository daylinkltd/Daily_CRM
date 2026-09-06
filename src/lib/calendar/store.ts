"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  CalendarEvent,
  SocialPost,
  CRMActivity,
  BlogPost,
  Campaign,
  ContentIdea,
  MarketingNotification,
  MarketingSettings,
  CalendarFilters,
  UserRole,
  UserProfile,
  PostStatus,
  CRMActivityStatus,
  SocialPlatform,
  AuditHistoryItem,
  AIMarketingInsight,
  MarketingAttribution,
  JourneyTouchpoint,
  LeadTemperature,
  LeadIntent,
} from '@/types/calendar';
import {
  INITIAL_CRM_ACTIVITIES,
  INITIAL_SOCIAL_POSTS,
  INITIAL_BLOG_POSTS,
  INITIAL_CAMPAIGNS,
  INITIAL_CONTENT_IDEAS,
  INITIAL_MARKETING_NOTIFICATIONS,
  INITIAL_MARKETING_SETTINGS,
  INITIAL_AI_INSIGHTS,
  INITIAL_MARKETING_CONTACTS,
} from './mock-data';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { socialPublishingService } from '@/lib/services/social-publishing';
import { toast } from 'sonner';

const STORAGE_KEY_POSTS = 'dailycrm_marketing_social_posts_live_clean_v1';
const STORAGE_KEY_CRM = 'dailycrm_marketing_crm_activities_live_clean_v1';
const STORAGE_KEY_BLOG = 'dailycrm_marketing_blog_posts_live_clean_v1';
const STORAGE_KEY_CAMPAIGNS = 'dailycrm_marketing_campaigns_live_clean_v1';
const STORAGE_KEY_IDEAS = 'dailycrm_marketing_ideas_live_clean_v1';
const STORAGE_KEY_NOTIFS = 'dailycrm_marketing_notifications_live_clean_v1';
const STORAGE_KEY_SETTINGS = 'dailycrm_marketing_settings_live_clean_v1';
const STORAGE_KEY_ROLE = 'dailycrm_marketing_active_user_role_live_clean_v1';
const STORAGE_KEY_INSIGHTS = 'dailycrm_marketing_ai_insights_live_clean_v1';
const STORAGE_KEY_MKT_CONTACTS = 'dailycrm_marketing_contacts_live_clean_v1';

export function useCalendarStore() {
  // Current Active Demo User Role ('usr_alex' | 'usr_vivian' | 'usr_admin')
  const [activeUserId, setActiveUserId] = useState<string>('usr_alex');

  // Active View Mode
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');

  // Dynamic Date Focus (Default to August 2026 as per sample dataset context, but fully dynamic)
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 7, 25)); // 25 Aug 2026

  // Events & Marketing Entities State
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>(INITIAL_SOCIAL_POSTS);
  const [crmActivities, setCrmActivities] = useState<CRMActivity[]>(INITIAL_CRM_ACTIVITIES);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>(INITIAL_BLOG_POSTS);
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [contentIdeas, setContentIdeas] = useState<ContentIdea[]>(INITIAL_CONTENT_IDEAS);
  const [notifications, setNotifications] = useState<MarketingNotification[]>(INITIAL_MARKETING_NOTIFICATIONS);
  const [aiInsights, setAiInsights] = useState<AIMarketingInsight[]>(INITIAL_AI_INSIGHTS);
  const [marketingContacts, setMarketingContacts] = useState<any[]>(INITIAL_MARKETING_CONTACTS);
  const [marketingSettings, setMarketingSettings] = useState<MarketingSettings>(INITIAL_MARKETING_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Filters State
  const [filters, setFilters] = useState<CalendarFilters>({
    primary: 'all',
    channels: [],
    socialStatus: 'all',
    crmStatus: 'all',
    searchQuery: '',
  });

  // Modal / Drawer UI State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);

  const [isCRMModalOpen, setIsCRMModalOpen] = useState(false);
  const [editingCRMActivity, setEditingCRMActivity] = useState<CRMActivity | null>(null);

  const [reviewingPost, setReviewingPost] = useState<SocialPost | null>(null);
  const [historyPost, setHistoryPost] = useState<SocialPost | null>(null);
  const [analyticsPost, setAnalyticsPost] = useState<SocialPost | null>(null);

  const [isNoDateOpen, setIsNoDateOpen] = useState(false);

  // Load Initial State from LocalStorage or Defaults
  useEffect(() => {
    try {
      const savedPosts = localStorage.getItem(STORAGE_KEY_POSTS);
      const savedCRM = localStorage.getItem(STORAGE_KEY_CRM);
      const savedBlog = localStorage.getItem(STORAGE_KEY_BLOG);
      const savedCampaigns = localStorage.getItem(STORAGE_KEY_CAMPAIGNS);
      const savedIdeas = localStorage.getItem(STORAGE_KEY_IDEAS);
      const savedNotifs = localStorage.getItem(STORAGE_KEY_NOTIFS);
      const savedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
      const savedRole = localStorage.getItem(STORAGE_KEY_ROLE);

      if (savedPosts) {
        setSocialPosts(JSON.parse(savedPosts));
      } else {
        setSocialPosts(INITIAL_SOCIAL_POSTS);
      }

      if (savedCRM) {
        setCrmActivities(JSON.parse(savedCRM));
      } else {
        setCrmActivities(INITIAL_CRM_ACTIVITIES);
      }

      if (savedBlog) {
        setBlogPosts(JSON.parse(savedBlog));
      } else {
        setBlogPosts(INITIAL_BLOG_POSTS);
      }

      if (savedCampaigns) {
        setCampaigns(JSON.parse(savedCampaigns));
      } else {
        setCampaigns(INITIAL_CAMPAIGNS);
      }

      const savedInsights = localStorage.getItem(STORAGE_KEY_INSIGHTS);
      const savedMktContacts = localStorage.getItem(STORAGE_KEY_MKT_CONTACTS);

      if (savedIdeas) {
        setContentIdeas(JSON.parse(savedIdeas));
      } else {
        setContentIdeas(INITIAL_CONTENT_IDEAS);
      }

      if (savedNotifs) {
        setNotifications(JSON.parse(savedNotifs));
      } else {
        setNotifications(INITIAL_MARKETING_NOTIFICATIONS);
      }

      if (savedInsights) {
        setAiInsights(JSON.parse(savedInsights));
      } else {
        setAiInsights(INITIAL_AI_INSIGHTS);
      }

      if (savedMktContacts) {
        setMarketingContacts(JSON.parse(savedMktContacts));
      } else {
        setMarketingContacts(INITIAL_MARKETING_CONTACTS);
      }

      if (savedSettings) {
        setMarketingSettings(JSON.parse(savedSettings));
      } else {
        setMarketingSettings(INITIAL_MARKETING_SETTINGS);
      }
    } catch (e) {
      console.error('[MarketingStore] Failed to parse local storage:', e);
      setSocialPosts(INITIAL_SOCIAL_POSTS);
      setCrmActivities(INITIAL_CRM_ACTIVITIES);
      setBlogPosts(INITIAL_BLOG_POSTS);
      setCampaigns(INITIAL_CAMPAIGNS);
      setContentIdeas(INITIAL_CONTENT_IDEAS);
      setNotifications(INITIAL_MARKETING_NOTIFICATIONS);
      setAiInsights(INITIAL_AI_INSIGHTS);
      setMarketingContacts(INITIAL_MARKETING_CONTACTS);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save changes to localStorage
  const savePosts = useCallback((posts: SocialPost[]) => {
    setSocialPosts(posts);
    try {
      localStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(posts));
    } catch (e) {
      console.error('[MarketingStore] Error saving posts:', e);
    }
  }, []);

  const saveCRM = useCallback((activities: CRMActivity[]) => {
    setCrmActivities(activities);
    try {
      localStorage.setItem(STORAGE_KEY_CRM, JSON.stringify(activities));
    } catch (e) {
      console.error('[MarketingStore] Error saving CRM activities:', e);
    }
  }, []);

  const saveBlog = useCallback((posts: BlogPost[]) => {
    setBlogPosts(posts);
    try {
      localStorage.setItem(STORAGE_KEY_BLOG, JSON.stringify(posts));
    } catch (e) {
      console.error('[MarketingStore] Error saving Blog posts:', e);
    }
  }, []);

  const saveCampaigns = useCallback((camps: Campaign[]) => {
    setCampaigns(camps);
    try {
      localStorage.setItem(STORAGE_KEY_CAMPAIGNS, JSON.stringify(camps));
    } catch (e) {
      console.error('[MarketingStore] Error saving campaigns:', e);
    }
  }, []);

  const saveIdeas = useCallback((ideas: ContentIdea[]) => {
    setContentIdeas(ideas);
    try {
      localStorage.setItem(STORAGE_KEY_IDEAS, JSON.stringify(ideas));
    } catch (e) {
      console.error('[MarketingStore] Error saving ideas:', e);
    }
  }, []);

  const saveNotifications = useCallback((notifs: MarketingNotification[]) => {
    setNotifications(notifs);
    try {
      localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(notifs));
    } catch (e) {
      console.error('[MarketingStore] Error saving notifications:', e);
    }
  }, []);

  const saveInsights = useCallback((insights: AIMarketingInsight[]) => {
    setAiInsights(insights);
    try {
      localStorage.setItem(STORAGE_KEY_INSIGHTS, JSON.stringify(insights));
    } catch (e) {
      console.error('[MarketingStore] Error saving AI insights:', e);
    }
  }, []);

  const saveMarketingContacts = useCallback((contacts: any[]) => {
    setMarketingContacts(contacts);
    try {
      localStorage.setItem(STORAGE_KEY_MKT_CONTACTS, JSON.stringify(contacts));
    } catch (e) {
      console.error('[MarketingStore] Error saving marketing contacts:', e);
    }
  }, []);

  const saveSettings = useCallback((settings: MarketingSettings) => {
    setMarketingSettings(settings);
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('[MarketingStore] Error saving settings:', e);
    }
  }, []);

  const { user: authUser, profile } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [activeRoleOverride, setActiveRoleOverride] = useState<UserRole | null>(null);

  const switchRole = useCallback((roleKey: 'alex' | 'vivian' | 'admin') => {
    const mappedRole: UserRole = roleKey === 'alex' ? 'creator' : roleKey === 'vivian' ? 'approver' : 'admin';
    setActiveRoleOverride(mappedRole);
    toast.info(`Switched view perspective to ${mappedRole.toUpperCase()}`);
  }, []);

  // Current active user object derived from real authenticated session
  const currentUser: UserProfile = useMemo(() => {
    const name = profile?.full_name || authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'Administrator';
    const email = authUser?.email || profile?.email || 'admin@dailybuz.com';
    const baseRole: UserRole = (profile?.role === 'admin' || profile?.account_role === 'owner' || profile?.account_role === 'admin') ? 'admin' : 'creator';
    const effectiveRole = activeRoleOverride || baseRole;

    return {
      id: authUser?.id || 'usr_current',
      name,
      email,
      role: effectiveRole,
      roleTitle: effectiveRole === 'admin' ? 'Administrator' : effectiveRole === 'approver' ? 'Marketing Approver' : 'Marketing Creator',
      avatarUrl: profile?.avatar_url || '',
    };
  }, [authUser, profile, activeRoleOverride]);

  // Combined and Filtered Events
  const filteredEvents: CalendarEvent[] = useMemo(() => {
    const query = filters.searchQuery.toLowerCase().trim();

    // Filter Social Posts
    const matchedPosts = socialPosts.filter((post) => {
      if (filters.primary === 'crm' || filters.primary === 'blog') return false;

      // Social Channel filter (multi-select)
      if (filters.channels.length > 0) {
        const hasChannel = post.channels.some((ch) => filters.channels.includes(ch));
        if (!hasChannel) return false;
      }

      // Social status filter
      if (filters.socialStatus !== 'all' && post.status !== filters.socialStatus) {
        return false;
      }

      // Campaign filter
      if (filters.campaignId && post.campaignId !== filters.campaignId) {
        return false;
      }

      // Creator filter
      if (filters.creatorId && post.creatorId !== filters.creatorId) {
        return false;
      }

      // Search query
      if (query) {
        const titleMatch = post.title.toLowerCase().includes(query);
        const captionMatch = post.defaultCaption.toLowerCase().includes(query);
        const creatorMatch = post.creatorName.toLowerCase().includes(query);
        const channelMatch = post.channels.some((c) => c.toLowerCase().includes(query));
        const campaignMatch = post.tagsCampaign?.toLowerCase().includes(query) ?? false;
        const dealMatch = post.crmDealName?.toLowerCase().includes(query) ?? false;
        const companyMatch = post.crmCompanyName?.toLowerCase().includes(query) ?? false;
        if (!titleMatch && !captionMatch && !creatorMatch && !channelMatch && !campaignMatch && !dealMatch && !companyMatch) {
          return false;
        }
      }

      return true;
    });

    // Filter CRM Activities
    const matchedCRM = crmActivities.filter((act) => {
      if (filters.primary === 'social' || filters.primary === 'blog') return false;

      // CRM status filter
      if (filters.crmStatus !== 'all' && act.status !== filters.crmStatus) {
        return false;
      }

      // Search query
      if (query) {
        const titleMatch = act.title.toLowerCase().includes(query);
        const contactMatch = act.contactName?.toLowerCase().includes(query) ?? false;
        const companyMatch = act.companyName?.toLowerCase().includes(query) ?? false;
        const dealMatch = act.dealName?.toLowerCase().includes(query) ?? false;
        const typeMatch = act.type.toLowerCase().includes(query);
        if (!titleMatch && !contactMatch && !companyMatch && !dealMatch && !typeMatch) {
          return false;
        }
      }

      return true;
    });

    // Filter Blog Posts
    const matchedBlog = blogPosts.filter((blog) => {
      if (filters.primary === 'crm' || filters.primary === 'social') return false;

      if (filters.socialStatus !== 'all' && blog.status !== filters.socialStatus) {
        return false;
      }

      if (filters.campaignId && blog.campaignId !== filters.campaignId) {
        return false;
      }

      if (query) {
        const titleMatch = blog.title.toLowerCase().includes(query);
        const summaryMatch = blog.summary.toLowerCase().includes(query);
        const authorMatch = blog.authorName.toLowerCase().includes(query);
        if (!titleMatch && !summaryMatch && !authorMatch) return false;
      }

      return true;
    });

    return [...matchedPosts, ...matchedCRM, ...matchedBlog];
  }, [socialPosts, crmActivities, blogPosts, filters]);

  // No-date items (Drafts, CRM activities without dates)
  const noDateEvents = useMemo(() => {
    const undatedPosts = socialPosts.filter((p) => !p.date);
    const undatedCRM = crmActivities.filter((c) => !c.date);
    const undatedBlog = blogPosts.filter((b) => !b.date);
    return [...undatedPosts, ...undatedCRM, ...undatedBlog];
  }, [socialPosts, crmActivities, blogPosts]);

  // -------------------------------------------------------------
  // WORKFLOW ACTIONS
  // -------------------------------------------------------------

  const helperAddAudit = useCallback((
    post: SocialPost,
    action: AuditHistoryItem['action'],
    comment?: string
  ): SocialPost => {
    const newAudit: AuditHistoryItem = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      action,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.roleTitle,
      comment,
    };
    return {
      ...post,
      updatedAt: new Date().toISOString(),
      auditHistory: [newAudit, ...(post.auditHistory || [])],
    };
  }, [currentUser]);

  const addNotification = useCallback((
    title: string,
    message: string,
    type: MarketingNotification['type'],
    targetId?: string
  ) => {
    const newNotif: MarketingNotification = {
      id: `notif_${Date.now()}`,
      title,
      message,
      type,
      targetId,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    saveNotifications([newNotif, ...notifications]);
  }, [notifications, saveNotifications]);

  const createSocialPost = useCallback(
    (postData: Partial<SocialPost>) => {
      const approverId = postData.approverId || 'admin';
      const approverName = postData.approverName || (approverId === 'admin' ? 'Administrator' : 'Marketing Reviewer');

      const newPost: SocialPost = {
        id: `soc_post_${Date.now()}`,
        category: 'social',
        title: postData.title || 'Untitled Social Post',
        contentType: postData.contentType || 'post',
        channels: postData.channels && postData.channels.length > 0 ? postData.channels : ['instagram'],
        defaultCaption: postData.defaultCaption || '',
        mediaUrl: postData.mediaUrl,
        mediaUrls: postData.mediaUrls,
        mediaType: postData.mediaType || 'image',
        hashtags: postData.hashtags || [],
        mentions: postData.mentions || [],
        link: postData.link,
        altText: postData.altText,
        firstComment: postData.firstComment,
        tagsCampaign: postData.tagsCampaign,
        campaignId: postData.campaignId,
        status: postData.status || 'draft',
        creatorId: currentUser.id,
        creatorName: currentUser.name,
        creatorAvatar: currentUser.avatarUrl,
        approverId,
        approverName,
        crmContactName: postData.crmContactName,
        crmCompanyName: postData.crmCompanyName,
        crmDealName: postData.crmDealName,
        crmCampaignName: postData.crmCampaignName,
        crmTaskName: postData.crmTaskName,
        crmProjectName: postData.crmProjectName,
        date: postData.date,
        time: postData.time || '12:00',
        timezone: postData.timezone || 'UTC',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        platformOverrides: postData.platformOverrides || {},
        auditHistory: [
          {
            id: `aud_init_${Date.now()}`,
            timestamp: new Date().toISOString(),
            action: 'created',
            userId: currentUser.id,
            userName: currentUser.name,
            userRole: currentUser.roleTitle,
          },
        ],
      };

      if (newPost.status === 'pending_approval') {
        newPost.auditHistory.unshift({
          id: `aud_sub_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'submitted',
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.roleTitle,
          comment: `Submitted to ${newPost.approverName} for review.`,
        });

        addNotification(
          'Post Submitted for Approval',
          `${currentUser.name} submitted "${newPost.title}" for review.`,
          'approval_submitted',
          newPost.id
        );
      }

      savePosts([newPost, ...socialPosts]);
    },
    [currentUser, socialPosts, savePosts, addNotification]
  );

  const updateSocialPost = useCallback(
    (updated: SocialPost) => {
      const nextPosts = socialPosts.map((p) => {
        if (p.id === updated.id) {
          const withAudit = helperAddAudit(updated, 'edited');
          return withAudit;
        }
        return p;
      });
      savePosts(nextPosts);
    },
    [socialPosts, savePosts, helperAddAudit]
  );

  const submitForApproval = useCallback(
    (postId: string) => {
      const target = socialPosts.find((p) => p.id === postId);
      if (!target) return;

      const isResubmit = target.status === 'changes_requested';
      const nextStatus: PostStatus = 'pending_approval';

      const nextPosts = socialPosts.map((p) => {
        if (p.id === postId) {
          const updated = { ...p, status: nextStatus };
          return helperAddAudit(updated, isResubmit ? 'resubmitted' : 'submitted');
        }
        return p;
      });
      savePosts(nextPosts);

      addNotification(
        isResubmit ? 'Post Resubmitted' : 'Post Submitted for Approval',
        `${currentUser.name} submitted "${target.title}" for review.`,
        'approval_submitted',
        postId
      );
    },
    [socialPosts, savePosts, helperAddAudit, addNotification, currentUser]
  );

  const approvePost = useCallback(
    (postId: string) => {
      const target = socialPosts.find((p) => p.id === postId);
      if (!target) return;

      if (target.creatorId === currentUser.id && currentUser.role !== 'admin') {
        toast.error('Action Not Allowed: A creator cannot approve their own post.');
        return;
      }

      const nextPosts = socialPosts.map((p) => {
        if (p.id === postId) {
          const updated: SocialPost = {
            ...p,
            status: 'approved',
            approverId: currentUser.id,
            approverName: currentUser.name,
          };
          return helperAddAudit(updated, 'approved', 'Post approved for scheduling and publication.');
        }
        return p;
      });
      savePosts(nextPosts);

      addNotification(
        'Post Approved',
        `"${target.title}" was approved by ${currentUser.name}.`,
        'approval_approved',
        postId
      );
    },
    [socialPosts, savePosts, currentUser, helperAddAudit, addNotification]
  );

  const requestChanges = useCallback(
    (postId: string, comment: string) => {
      const target = socialPosts.find((p) => p.id === postId);
      if (!target) return;

      const nextPosts = socialPosts.map((p) => {
        if (p.id === postId) {
          const updated: SocialPost = { ...p, status: 'changes_requested' };
          return helperAddAudit(updated, 'changes_requested', comment);
        }
        return p;
      });
      savePosts(nextPosts);

      addNotification(
        'Changes Requested',
        `${currentUser.name} requested changes on "${target.title}": "${comment}"`,
        'changes_requested',
        postId
      );
    },
    [socialPosts, savePosts, helperAddAudit, addNotification, currentUser]
  );

  const rejectPost = useCallback(
    (postId: string, comment?: string) => {
      const target = socialPosts.find((p) => p.id === postId);
      if (!target) return;

      const nextPosts = socialPosts.map((p) => {
        if (p.id === postId) {
          const updated: SocialPost = { ...p, status: 'rejected' };
          return helperAddAudit(updated, 'rejected', comment || 'Post rejected by reviewer.');
        }
        return p;
      });
      savePosts(nextPosts);

      addNotification(
        'Post Rejected',
        `"${target.title}" was rejected by ${currentUser.name}.`,
        'approval_rejected',
        postId
      );
    },
    [socialPosts, savePosts, helperAddAudit, addNotification, currentUser]
  );

  const reassignApprover = useCallback(
    (postId: string, newApproverId: string) => {
      const name = newApproverId === 'admin' ? 'Administrator' : newApproverId === 'manager' ? 'Marketing Manager' : 'Marketing Reviewer';

      const nextPosts = socialPosts.map((p) => {
        if (p.id === postId) {
          const updated: SocialPost = {
            ...p,
            approverId: newApproverId,
            approverName: name,
          };
          return helperAddAudit(updated, 'reassigned', `Approval reassigned to ${name}`);
        }
        return p;
      });
      savePosts(nextPosts);
      toast.success(`Approver reassigned to ${name}`);
    },
    [socialPosts, savePosts, helperAddAudit]
  );

  const schedulePost = useCallback(
    async (postId: string, date: string, time: string) => {
      const target = socialPosts.find((p) => p.id === postId);
      if (!target) return;

      if (target.status !== 'approved' && target.status !== 'scheduled') {
        toast.error('Action Not Allowed: Only approved posts can be scheduled.');
        return;
      }

      const prepPost: SocialPost = { ...target, date, time, status: 'scheduled' };
      await socialPublishingService.schedulePost(prepPost, activeWorkspace?.id);

      const nextPosts = socialPosts.map((p) => {
        if (p.id === postId) {
          const updated: SocialPost = {
            ...p,
            date,
            time,
            status: 'scheduled',
          };
          return helperAddAudit(updated, 'scheduled', `Scheduled for ${date} at ${time}`);
        }
        return p;
      });
      savePosts(nextPosts);
    },
    [socialPosts, savePosts, helperAddAudit, activeWorkspace?.id]
  );

  const publishPostNow = useCallback(
    async (postId: string) => {
      const target = socialPosts.find((p) => p.id === postId);
      if (!target) return;

      if (target.status === 'pending_approval' && currentUser.role !== 'admin') {
        toast.error('Action Not Allowed: Pending approval posts cannot be published directly.');
        return;
      }

      await socialPublishingService.publishPost(target, activeWorkspace?.id);

      const nextPosts = socialPosts.map((p) => {
        if (p.id === postId) {
          const updated: SocialPost = {
            ...p,
            status: 'published',
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            analytics: p.analytics || {
              reach: 0,
              likes: 0,
              comments: 0,
              shares: 0,
              clicks: 0,
              engagementRate: 0,
            },
          };
          return helperAddAudit(updated, 'published', 'Published live across selected channels.');
        }
        return p;
      });
      savePosts(nextPosts);

      addNotification(
        'Post Published',
        `"${target.title}" is now published live.`,
        'post_published',
        postId
      );

      toast.success('Post published live across channels!');
    },
    [socialPosts, savePosts, currentUser, helperAddAudit, addNotification]
  );

  // Blog Posts Actions
  const createBlogPost = useCallback((blogData: Partial<BlogPost>) => {
    const newBlog: BlogPost = {
      id: `blog_post_${Date.now()}`,
      category: 'blog',
      title: blogData.title || 'Untitled Blog Post',
      slug: blogData.slug || `post-${Date.now()}`,
      featuredImage: blogData.featuredImage,
      excerpt: blogData.excerpt,
      content: blogData.content,
      summary: blogData.summary || blogData.excerpt || 'Blog article summary.',
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatarUrl,
      postCategory: blogData.postCategory || 'Productivity',
      tags: blogData.tags || ['Marketing', 'Productivity'],
      seoTitle: blogData.seoTitle || blogData.title,
      seoDescription: blogData.seoDescription || blogData.excerpt,
      keywords: blogData.keywords || [],
      campaignId: blogData.campaignId,
      campaignName: blogData.campaignName,
      date: blogData.date,
      time: blogData.time || '09:00',
      status: blogData.status || 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveBlog([newBlog, ...blogPosts]);
    toast.success('Blog post created successfully!');
  }, [blogPosts, currentUser, saveBlog]);

  const updateBlogPost = useCallback((updated: BlogPost) => {
    const next = blogPosts.map((b) => (b.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : b));
    saveBlog(next);
    toast.success('Blog post updated.');
  }, [blogPosts, saveBlog]);

  const deleteBlogPost = useCallback((id: string) => {
    const next = blogPosts.filter((b) => b.id !== id);
    saveBlog(next);
    toast.success('Blog post deleted.');
  }, [blogPosts, saveBlog]);

  // Campaigns Actions
  const createCampaign = useCallback((campData: Partial<Campaign>) => {
    const newCamp: Campaign = {
      id: `camp_${Date.now()}`,
      name: campData.name || 'Untitled Campaign',
      description: campData.description || '',
      objective: campData.objective || '',
      startDate: campData.startDate || new Date().toISOString().split('T')[0],
      endDate: campData.endDate || '2026-12-31',
      ownerId: currentUser.id,
      ownerName: currentUser.name,
      teamMemberIds: campData.teamMemberIds || [currentUser.id],
      platforms: campData.platforms || ['linkedin', 'instagram', 'x'],
      budget: campData.budget || 5000,
      spent: 0,
      status: campData.status || 'draft',
      createdAt: new Date().toISOString(),
    };
    saveCampaigns([newCamp, ...campaigns]);
    toast.success(`Campaign "${newCamp.name}" created.`);
  }, [campaigns, currentUser, saveCampaigns]);

  const updateCampaign = useCallback((updated: Campaign) => {
    const next = campaigns.map((c) => (c.id === updated.id ? updated : c));
    saveCampaigns(next);
    toast.success('Campaign updated.');
  }, [campaigns, saveCampaigns]);

  // Content Ideas Actions
  const createContentIdea = useCallback((ideaData: Partial<ContentIdea>) => {
    const newIdea: ContentIdea = {
      id: `idea_${Date.now()}`,
      title: ideaData.title || 'Untitled Idea',
      notes: ideaData.notes || '',
      platforms: ideaData.platforms || ['linkedin', 'instagram'],
      tags: ideaData.tags || ['Idea'],
      campaignId: ideaData.campaignId,
      campaignName: ideaData.campaignName,
      creatorName: currentUser.name,
      createdAt: new Date().toISOString(),
    };
    saveIdeas([newIdea, ...contentIdeas]);
    toast.success('Content idea saved!');
  }, [contentIdeas, currentUser, saveIdeas]);

  const deleteContentIdea = useCallback((ideaId: string) => {
    saveIdeas(contentIdeas.filter((i) => i.id !== ideaId));
    toast.success('Content idea removed.');
  }, [contentIdeas, saveIdeas]);

  // Notifications Actions
  const markNotificationRead = useCallback((notifId: string) => {
    const next = notifications.map((n) => (n.id === notifId ? { ...n, isRead: true } : n));
    saveNotifications(next);
  }, [notifications, saveNotifications]);

  const markAllNotificationsRead = useCallback(() => {
    const next = notifications.map((n) => ({ ...n, isRead: true }));
    saveNotifications(next);
    toast.success('All notifications marked as read.');
  }, [notifications, saveNotifications]);

  const createCRMActivity = useCallback(
    (data: Partial<CRMActivity>) => {
      const newActivity: CRMActivity = {
        id: `crm_act_${Date.now()}`,
        category: 'crm',
        type: data.type || 'meeting',
        title: data.title || 'Untitled CRM Activity',
        contactName: data.contactName,
        companyName: data.companyName,
        dealName: data.dealName,
        date: data.date,
        time: data.time || '10:00',
        status: data.status || 'upcoming',
        assigneeId: currentUser.id,
        assigneeName: currentUser.name,
        notes: data.notes,
        createdAt: new Date().toISOString(),
      };
      saveCRM([newActivity, ...crmActivities]);
    },
    [crmActivities, saveCRM, currentUser]
  );

  const updateCRMActivity = useCallback(
    (updated: CRMActivity) => {
      const nextCRM = crmActivities.map((c) => (c.id === updated.id ? updated : c));
      saveCRM(nextCRM);
    },
    [crmActivities, saveCRM]
  );

  // AI Insights Actions
  const dismissInsight = useCallback(
    (insightId: string) => {
      const next = aiInsights.map((i) => (i.id === insightId ? { ...i, status: 'dismissed' as const } : i));
      saveInsights(next);
      toast.info('Insight dismissed.');
    },
    [aiInsights, saveInsights]
  );

  const applyInsight = useCallback(
    (insightId: string) => {
      const target = aiInsights.find((i) => i.id === insightId);
      if (!target) return;
      const next = aiInsights.map((i) => (i.id === insightId ? { ...i, status: 'applied' as const } : i));
      saveInsights(next);
      toast.success(`Applied Recommendation: ${target.title}`);
    },
    [aiInsights, saveInsights]
  );

  // Marketing Lead Attribution & Inbound Intent Processing
  const createOrUpdateMarketingContact = useCallback(
    (contactData: {
      name: string;
      email?: string;
      phone?: string;
      company?: string;
      source: string;
      sourceType?: string;
      campaign?: string;
      campaignId?: string;
      content?: string;
      firstTouch?: string;
      lastTouch?: string;
      intent?: string;
      temperature?: LeadTemperature;
      scoreDelta?: number;
      touchpointDetails?: string;
      touchpointType?: 'view' | 'click' | 'read' | 'comment' | 'enquiry' | 'form_submission' | 'chat';
    }) => {
      const existing = marketingContacts.find(
        (c) =>
          (contactData.email && c.email && c.email.toLowerCase() === contactData.email.toLowerCase()) ||
          (contactData.phone && c.phone && c.phone.replace(/\D/g, '') === contactData.phone.replace(/\D/g, '')) ||
          (c.name && c.name.toLowerCase() === contactData.name.toLowerCase())
      );

      const now = new Date().toISOString();
      const newTouchpoint: JourneyTouchpoint = {
        id: `tp_${Date.now()}`,
        channel: contactData.source,
        type: contactData.touchpointType || 'enquiry',
        title: contactData.touchpointDetails || `${contactData.source} Interaction`,
        timestamp: now,
        details: contactData.touchpointDetails,
        campaignName: contactData.campaign,
        contentTitle: contactData.content,
      };

      const baseScore = existing?.marketing_attribution?.leadScore || 50;
      const calculatedScore = Math.min(100, Math.max(10, baseScore + (contactData.scoreDelta || 25)));
      const temp: LeadTemperature = contactData.temperature || (calculatedScore >= 80 ? 'hot' : calculatedScore >= 50 ? 'warm' : 'cold');

      const autoTags = [
        `source:${contactData.source.toLowerCase().replace(/\s+/g, '-')}`,
        contactData.campaign ? `campaign:${contactData.campaign.toLowerCase().replace(/\s+/g, '-')}` : '',
        contactData.intent ? `intent:${contactData.intent.toLowerCase().replace(/\s+/g, '-')}` : '',
        `lead:${temp}`,
      ].filter(Boolean);

      let updatedContactList: any[];

      if (existing) {
        // Prevent duplicates — update existing record
        const mergedTouchpoints = [...(existing.marketing_attribution?.touchpoints || []), newTouchpoint];
        const mergedTags = Array.from(new Set([...(existing.tags || []), ...autoTags]));

        const updatedContact = {
          ...existing,
          name: contactData.name || existing.name,
          email: contactData.email || existing.email,
          phone: contactData.phone || existing.phone,
          company: contactData.company || existing.company,
          tags: mergedTags,
          updated_at: now,
          marketing_attribution: {
            ...existing.marketing_attribution,
            source: existing.marketing_attribution?.source || contactData.source,
            sourceType: existing.marketing_attribution?.sourceType || contactData.sourceType || 'Social Media',
            campaign: contactData.campaign || existing.marketing_attribution?.campaign,
            campaignId: contactData.campaignId || existing.marketing_attribution?.campaignId,
            content: contactData.content || existing.marketing_attribution?.content,
            firstTouch: existing.marketing_attribution?.firstTouch || contactData.firstTouch || contactData.source,
            lastTouch: contactData.lastTouch || contactData.source,
            leadScore: calculatedScore,
            leadTemperature: temp,
            intent: contactData.intent || existing.marketing_attribution?.intent || 'general_enquiry',
            touchpoints: mergedTouchpoints,
          },
        };

        updatedContactList = marketingContacts.map((c) => (c.id === existing.id ? updatedContact : c));
        saveMarketingContacts(updatedContactList);
        toast.success(`Updated CRM Contact & Journey: ${existing.name} (${temp.toUpperCase()} Lead)`);
        return updatedContact;
      } else {
        // Create new contact
        const newContact = {
          id: `cont_mkt_${Date.now()}`,
          name: contactData.name,
          email: contactData.email || `${contactData.name.toLowerCase().replace(/\s+/g, '.')}@inbound.co`,
          phone: contactData.phone || '+919800000000',
          company: contactData.company || 'Inbound Prospect',
          tags: autoTags,
          created_at: now,
          updated_at: now,
          marketing_attribution: {
            source: contactData.source,
            sourceType: contactData.sourceType || 'Social Media',
            campaign: contactData.campaign || 'Direct Marketing',
            campaignId: contactData.campaignId,
            content: contactData.content || 'Inbound Campaign Post',
            firstTouch: contactData.firstTouch || contactData.source,
            lastTouch: contactData.lastTouch || contactData.source,
            leadScore: calculatedScore,
            leadTemperature: temp,
            intent: contactData.intent || 'general_enquiry',
            touchpoints: [newTouchpoint],
          },
        };

        updatedContactList = [newContact, ...marketingContacts];
        saveMarketingContacts(updatedContactList);

        // Add Notification
        const newNotif: MarketingNotification = {
          id: `notif_lead_${Date.now()}`,
          title: `🔥 New ${temp.toUpperCase()} Lead Captured`,
          message: `${contactData.name} arrived from ${contactData.source} (${contactData.campaign || 'Campaign'}). Score: ${calculatedScore}.`,
          type: 'team_assignment',
          targetId: newContact.id,
          isRead: false,
          createdAt: now,
        };
        saveNotifications([newNotif, ...notifications]);

        toast.success(`🔥 Qualified Lead Connected to CRM: ${newContact.name}`);
        return newContact;
      }
    },
    [marketingContacts, notifications, saveMarketingContacts, saveNotifications]
  );

  // AI Intent Classifier & Engagement Filter
  const classifyAndProcessEngagement = useCallback(
    (params: {
      platform: SocialPlatform | string;
      message: string;
      authorName: string;
      authorEmail?: string;
      authorPhone?: string;
      campaignName?: string;
      campaignId?: string;
      contentTitle?: string;
    }) => {
      const lower = params.message.toLowerCase();

      // Detection Heuristics
      const isPricing = /price|cost|how much|pricing|rates|quote|fee|expensive|cheap|charge/i.test(lower);
      const isDemo = /demo|walkthrough|call|schedule|presentation|meeting|show me|trial|onboard/i.test(lower);
      const isProduct = /whatsapp|features?|integration|inventory|gst|pos|connect|api|capabilities/i.test(lower);
      const isGenericPraise = /nice|cool|great|awesome|love this|fire|good job|👍|🔥|❤️|clap/i.test(lower);

      let intent: LeadIntent = 'general_enquiry';
      let temperature: LeadTemperature = 'warm';
      let scoreDelta = 15;

      if (isDemo) {
        intent = 'demo';
        temperature = 'hot';
        scoreDelta = 40;
      } else if (isPricing) {
        intent = 'pricing';
        temperature = 'hot';
        scoreDelta = 35;
      } else if (isProduct) {
        intent = 'product_enquiry';
        temperature = 'warm';
        scoreDelta = 25;
      } else if (isGenericPraise) {
        temperature = 'engagement';
        scoreDelta = 5;
      }

      // DO NOT add simple likes / generic engagements to CRM contacts
      if (temperature === 'engagement' && !params.authorEmail && !params.authorPhone) {
        toast.info(`Engagement logged: "${params.message}" (Filtered from CRM Contacts)`);
        return {
          isLead: false,
          intent,
          temperature,
          scoreDelta,
          reason: 'Generic social engagement (Analytics only)',
        };
      }

      // Create or update CRM contact for qualified leads
      const contact = createOrUpdateMarketingContact({
        name: params.authorName,
        email: params.authorEmail,
        phone: params.authorPhone,
        source: params.platform,
        sourceType: 'Social Media',
        campaign: params.campaignName || 'Small Business Growth',
        campaignId: params.campaignId,
        content: params.contentTitle || 'Stop Losing Customers',
        firstTouch: `${params.platform} Post`,
        lastTouch: `${params.platform} Comment`,
        intent,
        temperature,
        scoreDelta,
        touchpointDetails: `Commented: "${params.message}"`,
        touchpointType: 'comment',
      });

      return {
        isLead: true,
        intent,
        temperature,
        scoreDelta,
        contact,
      };
    },
    [createOrUpdateMarketingContact]
  );

  // Batch AI Campaign Creation (Pending Approval by default)
  const createAICampaignBatch = useCallback(
    (batch: {
      name: string;
      objective: string;
      targetAudience: string;
      cta: string;
      platforms: SocialPlatform[];
      posts: Array<{
        title: string;
        caption: string;
        channels: SocialPlatform[];
        date?: string;
        time?: string;
        overrides?: Record<string, any>;
      }>;
      blog?: {
        title: string;
        summary: string;
        content?: string;
        slug?: string;
        tags?: string[];
      };
    }) => {
      const campId = `camp_${Date.now()}`;
      const slug = batch.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const now = new Date().toISOString();

      const newCampaign: Campaign = {
        id: campId,
        name: batch.name,
        slug,
        description: `AI-orchestrated marketing campaign focused on ${batch.targetAudience.toLowerCase()} with goal of ${batch.objective.toLowerCase()}.`,
        objective: batch.objective,
        targetAudience: batch.targetAudience,
        cta: batch.cta,
        startDate: '2026-08-25',
        endDate: '2026-09-15',
        ownerId: currentUser.id,
        ownerName: currentUser.name,
        teamMemberIds: [currentUser.id],
        platforms: batch.platforms,
        budget: 10000,
        spent: 0,
        status: 'active',
        metrics: {
          reach: 0,
          engagement: 0,
          clicks: 0,
          leads: 0,
          qualifiedLeads: 0,
          hotLeads: 0,
          opportunities: 0,
          revenue: 0,
        },
        createdAt: now,
      };

      const newPosts: SocialPost[] = batch.posts.map((p, idx) => {
        const utm = `?utm_source=${p.channels[0]}&utm_medium=social&utm_campaign=${slug}&utm_content=${p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        return {
          id: `soc_ai_${Date.now()}_${idx}`,
          category: 'social',
          title: p.title,
          channels: p.channels,
          defaultCaption: p.caption,
          hashtags: ['#DailyCRM', '#BusinessGrowth', '#Automations'],
          link: `https://dailybuz.com${utm}`,
          tagsCampaign: batch.name,
          campaignId: campId,
          status: 'pending_approval',
          creatorId: currentUser.id,
          creatorName: currentUser.name,
          creatorAvatar: currentUser.avatarUrl,
          date: p.date || `2026-08-${25 + idx}`,
          time: p.time || '10:00',
          timezone: 'UTC',
          createdAt: now,
          updatedAt: now,
          platformOverrides: p.overrides,
          auditHistory: [
            {
              id: `aud_ai_${Date.now()}_${idx}`,
              timestamp: now,
              action: 'created',
              userId: currentUser.id,
              userName: 'Conversational AI Assistant',
              userRole: 'AI Marketing Engine',
              comment: `Generated for campaign "${batch.name}" (Audience: ${batch.targetAudience})`,
            },
            {
              id: `aud_ai_sub_${Date.now()}_${idx}`,
              timestamp: now,
              action: 'submitted',
              userId: currentUser.id,
              userName: currentUser.name,
              userRole: currentUser.roleTitle,
              comment: 'Awaiting Admin Review & Approval',
            },
          ],
        };
      });

      let newBlogPosts = [...blogPosts];
      if (batch.blog) {
        const newBlog: BlogPost = {
          id: `blog_ai_${Date.now()}`,
          category: 'blog',
          title: batch.blog.title,
          slug: batch.blog.slug || batch.blog.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          summary: batch.blog.summary,
          content: batch.blog.content || batch.blog.summary,
          authorId: currentUser.id,
          authorName: currentUser.name,
          authorAvatar: currentUser.avatarUrl,
          campaignId: campId,
          campaignName: batch.name,
          tags: batch.blog.tags || ['Growth', 'Marketing', 'CRM'],
          date: '2026-08-28',
          time: '09:00',
          status: 'pending_approval',
          createdAt: now,
          updatedAt: now,
        };
        newBlogPosts = [newBlog, ...newBlogPosts];
        saveBlog(newBlogPosts);
      }

      saveCampaigns([newCampaign, ...campaigns]);
      savePosts([...newPosts, ...socialPosts]);

      // Notification
      const newNotif: MarketingNotification = {
        id: `notif_ai_camp_${Date.now()}`,
        title: 'New AI Campaign Pending Approval',
        message: `Campaign "${batch.name}" created with ${newPosts.length} posts and ${batch.blog ? '1 blog' : '0 blogs'}. Admin Approval Required.`,
        type: 'approval_submitted',
        targetId: newPosts[0]?.id,
        isRead: false,
        createdAt: now,
      };
      saveNotifications([newNotif, ...notifications]);

      toast.success(`Generated Campaign "${batch.name}" with ${newPosts.length} posts. Submitted for Admin Approval!`);
      return { campaign: newCampaign, posts: newPosts };
    },
    [campaigns, socialPosts, blogPosts, notifications, currentUser, saveCampaigns, savePosts, saveBlog, saveNotifications]
  );

  // Drag and drop event date move
  const moveEventDate = useCallback(
    (eventId: string, newDate: string) => {
      const isPost = socialPosts.some((p) => p.id === eventId);
      const isBlog = blogPosts.some((b) => b.id === eventId);

      if (isPost) {
        const nextPosts = socialPosts.map((p) => {
          if (p.id === eventId) {
            const updated = { ...p, date: newDate };
            return helperAddAudit(updated, 'rescheduled', `Date moved to ${newDate}`);
          }
          return p;
        });
        savePosts(nextPosts);
      } else if (isBlog) {
        const nextBlog = blogPosts.map((b) => (b.id === eventId ? { ...b, date: newDate } : b));
        saveBlog(nextBlog);
      } else {
        const nextCRM = crmActivities.map((c) => (c.id === eventId ? { ...c, date: newDate } : c));
        saveCRM(nextCRM);
      }
    },
    [socialPosts, blogPosts, crmActivities, savePosts, saveBlog, saveCRM, helperAddAudit]
  );

  // Dynamic Month Navigation
  const navigateMonth = useCallback((direction: 'prev' | 'next' | 'today') => {
    setCurrentDate((prev) => {
      if (direction === 'today') {
        return new Date();
      }
      const next = new Date(prev);
      if (direction === 'prev') {
        next.setMonth(next.getMonth() - 1);
      } else {
        next.setMonth(next.getMonth() + 1);
      }
      return next;
    });
  }, []);

  // ---------------------------------------------------------------
  // DERIVED SELECTORS
  // ---------------------------------------------------------------
  const scheduledPosts = useMemo(
    () => socialPosts.filter((p) => p.status === 'scheduled'),
    [socialPosts]
  );

  const pendingApprovalPosts = useMemo(
    () => socialPosts.filter((p) => p.status === 'pending_approval'),
    [socialPosts]
  );

  const draftPosts = useMemo(
    () => socialPosts.filter((p) => p.status === 'draft'),
    [socialPosts]
  );

  const publishedPosts = useMemo(
    () => socialPosts.filter((p) => p.status === 'published'),
    [socialPosts]
  );

  const approvedPosts = useMemo(
    () => socialPosts.filter((p) => p.status === 'approved'),
    [socialPosts]
  );

  const changesRequestedPosts = useMemo(
    () => socialPosts.filter((p) => p.status === 'changes_requested'),
    [socialPosts]
  );

  const rejectedPosts = useMemo(
    () => socialPosts.filter((p) => p.status === 'rejected'),
    [socialPosts]
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  // Duplicate a post
  const duplicatePost = useCallback(
    (postId: string) => {
      const source = socialPosts.find((p) => p.id === postId);
      if (!source) return;
      const copy: SocialPost = {
        ...source,
        id: `soc_post_${Date.now()}`,
        title: `Copy of ${source.title}`,
        status: 'draft',
        creatorId: currentUser.id,
        creatorName: currentUser.name,
        creatorAvatar: currentUser.avatarUrl,
        approverId: undefined,
        approverName: undefined,
        date: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        analytics: undefined,
        auditHistory: [
          {
            id: `aud_dup_${Date.now()}`,
            timestamp: new Date().toISOString(),
            action: 'created',
            userId: currentUser.id,
            userName: currentUser.name,
            userRole: currentUser.roleTitle,
            comment: `Duplicated from "${source.title}"`,
          },
        ],
      };
      savePosts([copy, ...socialPosts]);
      toast.success(`Duplicated "${source.title}" to Drafts`);
    },
    [socialPosts, currentUser, savePosts]
  );

  // Delete a post
  const deleteSocialPost = useCallback(
    (postId: string) => {
      savePosts(socialPosts.filter((p) => p.id !== postId));
      toast.success('Post deleted successfully');
    },
    [socialPosts, savePosts]
  );

  // Clear all data for clean testing
  const clearAllData = useCallback(() => {
    savePosts([]);
    saveCRM([]);
    saveBlog([]);
    saveCampaigns([]);
    saveIdeas([]);
    saveNotifications([]);
    saveInsights([]);
    saveMarketingContacts([]);
    toast.success('All marketing data cleared! Fresh slate ready.');
  }, [savePosts, saveCRM, saveBlog, saveCampaigns, saveIdeas, saveNotifications, saveInsights, saveMarketingContacts]);

  return {
    isLoaded,
    clearAllData,
    currentUser,
    switchRole,
    viewMode,
    setViewMode,
    currentDate,
    setCurrentDate,
    navigateMonth,
    filters,
    setFilters,
    filteredEvents,
    noDateEvents,
    socialPosts,
    crmActivities,
    blogPosts,
    campaigns,
    contentIdeas,
    notifications,
    aiInsights,
    marketingContacts,
    marketingSettings,
    unreadNotificationsCount,

    // Derived selectors
    scheduledPosts,
    pendingApprovalPosts,
    draftPosts,
    publishedPosts,
    approvedPosts,
    changesRequestedPosts,
    rejectedPosts,

    // Workflow actions
    createSocialPost,
    updateSocialPost,
    submitForApproval,
    approvePost,
    requestChanges,
    rejectPost,
    reassignApprover,
    schedulePost,
    publishPostNow,
    duplicatePost,
    deleteSocialPost,
    createBlogPost,
    updateBlogPost,
    deleteBlogPost,
    createCampaign,
    updateCampaign,
    createContentIdea,
    deleteContentIdea,
    markNotificationRead,
    markAllNotificationsRead,
    saveSettings,
    createCRMActivity,
    updateCRMActivity,
    moveEventDate,

    // AI & Lead Attribution actions
    dismissInsight,
    applyInsight,
    createOrUpdateMarketingContact,
    classifyAndProcessEngagement,
    createAICampaignBatch,

    // UI state
    isComposerOpen,
    setIsComposerOpen,
    editingPost,
    setEditingPost,
    isCRMModalOpen,
    setIsCRMModalOpen,
    editingCRMActivity,
    setEditingCRMActivity,
    reviewingPost,
    setReviewingPost,
    historyPost,
    setHistoryPost,
    analyticsPost,
    setAnalyticsPost,
    isNoDateOpen,
    setIsNoDateOpen,
  };
}
