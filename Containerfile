#
# Copyright (C) 2026 Red Hat, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# SPDX-License-Identifier: Apache-2.0

FROM docker.io/library/node:24-bookworm-slim AS builder

WORKDIR /opt/app-root/src
ENV CI=true

RUN npm install --global corepack@0.35.0 && corepack enable

# Install the locked dependencies before source changes invalidate the cache.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json vite.config.mts ./
COPY src/ ./src/
RUN pnpm build

FROM scratch

LABEL org.opencontainers.image.title="Lima" \
      org.opencontainers.image.description="Lima extension for Podman Desktop" \
      org.opencontainers.image.vendor="podman-desktop" \
      org.opencontainers.image.licenses="Apache-2.0" \
      io.podman-desktop.api.version=">=1.29.1"

COPY --from=builder /opt/app-root/src/dist/ /extension/dist/
COPY package.json icon.png logo-dark.png logo-light.png LICENSE README.md /extension/
