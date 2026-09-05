#!/bin/sh

cd test
pwd
echo 'b5bb9d8014a0f9b1d61e21e796d78dccdf1352f23cd32812f4850b878ae4944c' > key
CLI=../dist/run.js
chmod +x $CLI
echo 'starting server'
DEBUG=1 $CLI --serve &
sleep 5
echo 'starting self-test'
$CLI foo.test
ps ax
pkill node
