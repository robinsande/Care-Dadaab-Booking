FROM nginx:alpine
COPY . /usr/share/nginx/html/
# This line fixes the routing issue:
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
