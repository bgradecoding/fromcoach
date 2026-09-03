// Declarative WebMCP form attributes (toolname/tooldescription on <form>,
// toolparamdescription on fields) — see docs/WEBMCP_API_NOTES.md.
import "react";

declare module "react" {
  interface FormHTMLAttributes<T> extends HTMLAttributes<T> {
    toolname?: string;
    tooldescription?: string;
  }
  interface HTMLAttributes<T> {
    toolparamdescription?: string;
  }
}

// SubmitEvent.agentInvoked: true when a browser agent submitted the form.
declare global {
  interface SubmitEvent {
    agentInvoked?: boolean;
  }
}
