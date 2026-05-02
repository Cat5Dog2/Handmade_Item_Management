# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim
WORKDIR /workspace

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="${JAVA_HOME}/bin:${PATH}"

RUN mkdir -p "$JAVA_HOME" \
  && curl -fsSL "https://api.adoptium.net/v3/binary/latest/25/ga/linux/x64/jre/hotspot/normal/adoptium" -o /tmp/openjdk25.tar.gz \
  && tar -xzf /tmp/openjdk25.tar.gz -C "$JAVA_HOME" --strip-components=1 \
  && rm /tmp/openjdk25.tar.gz

RUN npm install -g firebase-tools

COPY docker/firebase-emulators/start-emulators.sh /usr/local/bin/start-emulators.sh
RUN chmod +x /usr/local/bin/start-emulators.sh

EXPOSE 4000 8081 9099 9199
CMD ["/usr/local/bin/start-emulators.sh"]
