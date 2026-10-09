# CLI module help behavior

`cy <module> --help` requests `/.help/<module>` from the local server. The server invokes the module's `[help]` Symbol
function and returns its text, falling back to the module's exported function names when no help function is available.
Help functions are invoked on demand rather than during module initialization. Tests cover successful help output, missing
modules, malformed responses, fallback output, and normal command routing.
