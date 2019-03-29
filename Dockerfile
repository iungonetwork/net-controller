FROM node:10 as builder
COPY . /app
WORKDIR /app
RUN npm install

FROM node:10-alpine
RUN apk add iptables
COPY --from=builder /app /app
COPY ./start.sh /start.sh
RUN chmod a+x /start.sh

WORKDIR /app
CMD ["/start.sh"]
