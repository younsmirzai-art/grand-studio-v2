import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          src?: string;
          poster?: string;
          alt?: string;
          "shadow-intensity"?: string;
          "auto-rotate"?: boolean;
          "camera-controls"?: boolean;
          exposure?: string;
        },
        HTMLElement
      >;
    }
  }
}

export {};
