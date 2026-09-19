# Go Backend
FROM golang:1.21-alpine AS go-builder
WORKDIR /app
COPY go.mod .
RUN go mod tidy
COPY . .
RUN go build -o /server ./cmd/server

# Final stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=go-builder /server .
COPY backend/ ./backend/
EXPOSE 8080
CMD ["./server"]
