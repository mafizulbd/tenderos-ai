FROM node:20-alpine

WORKDIR /app

COPY package.json .

RUN npm install

COPY . .

# Next.js inlines NEXT_PUBLIC_* vars into the client bundle at build time, so
# it must be a build ARG, not just a runtime `environment:` entry in compose.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

CMD ["npm", "start"]
