# nuts release server — runs on Wahoo EKS (wahoo-mfe-chart).
# Plain JS app, no build step, so a single stage on Node 22 LTS is sufficient.
FROM node:22-alpine

WORKDIR /usr/src/app

# Install production dependencies from the lockfile for reproducible builds.
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source.
COPY . .

# App listens on PORT (defaults to 5000 in bin/web.js). Config/secrets are
# injected at runtime by Kubernetes — do not bake them into the image.
EXPOSE 5000

CMD ["npm", "start"]
