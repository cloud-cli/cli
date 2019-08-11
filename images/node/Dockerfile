FROM d.homebots.io/v2/node-app

ARG GIT_URL
ARG GIT_BRANCH
ARG CACHEBUSTER

STOPSIGNAL SIGTERM

RUN [[ "${GIT_URL}" != "" ]] && bash /home/node/entrypoint.sh build ${GIT_URL} ${GIT_BRANCH};
