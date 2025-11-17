curl -v -H "Origin: https://sgucnpmfoodfast-production.up.railway.app" \                                                                                         ─╯
https://api-gateway-service-production-04a1.up.railway.app/api/products

Đây là log khi gõ lệnh trên 
* Host api-gateway-service-production-04a1.up.railway.app:443 was resolved.
* IPv6: (none)
* IPv4: 66.33.22.118
*   Trying 66.33.22.118:443...
* Connected to api-gateway-service-production-04a1.up.railway.app (66.33.22.118) port 443
* ALPN: curl offers h2,http/1.1
* (304) (OUT), TLS handshake, Client hello (1):
*  CAfile: /etc/ssl/cert.pem
*  CApath: none
* (304) (IN), TLS handshake, Server hello (2):
* (304) (IN), TLS handshake, Unknown (8):
* (304) (IN), TLS handshake, Certificate (11):
* (304) (IN), TLS handshake, CERT verify (15):
* (304) (IN), TLS handshake, Finished (20):
* (304) (OUT), TLS handshake, Finished (20):
* SSL connection using TLSv1.3 / AEAD-CHACHA20-POLY1305-SHA256 / [blank] / UNDEF
* ALPN: server accepted h2
* Server certificate:
*  subject: CN=*.up.railway.app
*  start date: Oct  6 16:07:50 2025 GMT
*  expire date: Jan  4 16:07:49 2026 GMT
*  subjectAltName: host "api-gateway-service-production-04a1.up.railway.app" matched cert's "*.up.railway.app"
*  issuer: C=US; O=Let's Encrypt; CN=R13
*  SSL certificate verify ok.
* using HTTP/2
* [HTTP/2] [1] OPENED stream for https://api-gateway-service-production-04a1.up.railway.app/api/products
* [HTTP/2] [1] [:method: GET]
* [HTTP/2] [1] [:scheme: https]
* [HTTP/2] [1] [:authority: api-gateway-service-production-04a1.up.railway.app]
* [HTTP/2] [1] [:path: /api/products]
* [HTTP/2] [1] [user-agent: curl/8.7.1]
* [HTTP/2] [1] [accept: */*]
* [HTTP/2] [1] [origin: https://sgucnpmfoodfast-production.up.railway.app]
> GET /api/products HTTP/2
> Host: api-gateway-service-production-04a1.up.railway.app
> User-Agent: curl/8.7.1
> Accept: */*
> Origin: https://sgucnpmfoodfast-production.up.railway.app
>
* Request completely sent off
  < HTTP/2 301
  < access-control-allow-credentials: true
  < access-control-allow-origin: https://sgucnpmfoodfast-production.up.railway.app
  < cache-control: no-store
  < content-security-policy: default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests
  < content-type: text/html; charset=utf-8
  < cross-origin-opener-policy: same-origin
  < cross-origin-resource-policy: same-origin
  < date: Mon, 17 Nov 2025 09:54:08 GMT
  < location: https://product-serivce-production.up.railway.app/products
  < origin-agent-cluster: ?1
  < referrer-policy: no-referrer
  < server: railway-edge
  < strict-transport-security: max-age=31536000; includeSubDomains
  < vary: Origin, Accept-Encoding
  < x-content-type-options: nosniff
  < x-dns-prefetch-control: off
  < x-download-options: noopen
  < x-frame-options: SAMEORIGIN
  < x-permitted-cross-domain-policies: none
  < x-railway-edge: railway/asia-southeast1-eqsg3a
  < x-railway-edge: railway/us-west2
  < x-railway-request-id: Nw3N0LoZSimt2nMWDcO5xA
  < x-railway-request-id: h7eiIa8CRrmneleq2prcFg
  < x-xss-protection: 0
  < content-length: 93
  <
  <a href="https://product-serivce-production.up.railway.app/products">Moved Permanently</a>.

* Connection #0 to host api-gateway-service-production-04a1.up.railway.app left intact


Đây là log khi build deploy trên railway

[Region: us-west1]
=========================
Using Detected Dockerfile
=========================

context: 8b0k-edxo

internal
load build definition from Dockerfile
0ms

internal
load metadata for docker.io/library/nginx:alpine
600ms

internal
load metadata for docker.io/library/node:20-alpine
564ms

auth
library/node:pull token for registry-1.docker.io
0ms

auth
library/nginx:pull token for registry-1.docker.io
0ms

internal
load .dockerignore
0ms

builder
FROM docker.io/library/node:20-alpine@sha256:6178e78b972f79c335df281f4b7674a2d85071aae2af020ffa39f0a770265435
10ms

internal
load build context
0ms

stage-1
FROM docker.io/library/nginx:alpine@sha256:b3c656d55d7ad751196f21b7fd2e8d4da9cb430e32f646adcf92441b72f82b14
12ms

stage-1
COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template cached
0ms

builder
RUN npm install cached
0ms

builder
COPY package*.json ./ cached
0ms

builder
WORKDIR /app cached
0ms

stage-1
COPY docker-entrypoint.sh /docker-entrypoint.sh
15ms

builder
COPY . .
29ms

stage-1
RUN chmod +x /docker-entrypoint.sh
211ms

builder
RUN rm -f nginx.conf
127ms

builder
RUN npm run build
9s
✓ built in 3.47s

stage-1
COPY --from=builder /app/dist /usr/share/nginx/html
26ms

auth
sharing credentials for production-us-west2.railway-registry.com
0ms

importing to docker
512ms
Build time: 24.98 seconds