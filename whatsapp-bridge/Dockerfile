# Dailybuz WhatsApp Bridge — small static binary, no CGO.
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /bridge .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 bridge
USER bridge
COPY --from=build /bridge /usr/local/bin/bridge
# Inbound media lands here — mount a volume so it survives restarts.
VOLUME /data/media
EXPOSE 8090
ENTRYPOINT ["bridge"]
