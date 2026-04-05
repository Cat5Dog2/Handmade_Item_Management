# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim
WORKDIR /workspace
RUN apt-get update \
  && apt-get install -y --no-install-recommends openjdk-17-jre-headless bash ca-certificates curl \
  && npm install -g firebase-tools \
  && rm -rf /var/lib/apt/lists/*

COPY docker/firebase-emulators/start-emulators.sh /usr/local/bin/start-emulators.sh
RUN chmod +x /usr/local/bin/start-emulators.sh

EXPOSE 4000 8081 9099 9199
CMD ["/usr/local/bin/start-emulators.sh"]
