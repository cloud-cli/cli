FROM d.homebots.io/v2/nginx

ARG GIT_URL
ARG GIT_BRANCH
ARG CACHEBUSTER

RUN [[ "${GIT_URL}" != "" ]] \
  && rm -rf /usr/share/nginx/html \
  && git clone --depth 1 ${GIT_URL} -b ${GIT_BRANCH} /opt/site \
  && rm -rf /opt/site/.git

RUN [[ -d /opt/site/dist ]] && ln -s /opt/site/dist /usr/share/nginx/html || ln -s /opt/site /usr/share/nginx/html

WORKDIR /usr/share/nginx/html

