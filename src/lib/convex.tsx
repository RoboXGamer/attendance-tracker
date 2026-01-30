import { CONVEX_URL } from "astro:env/client";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { type FunctionComponent } from "react";

const client = new ConvexReactClient(CONVEX_URL);

// Astro context providers don't work when used in .astro files.
// See this and other related issues: https://github.com/withastro/astro/issues/2016#issuecomment-981833594
//
// This exists to conveniently wrap any component that uses Convex.
export function withConvexProvider<Props>(Component: FunctionComponent<Props>) {
  return function WithConvexProvider(props: Props) {
    return (
      <ConvexProvider client={client}>
        <Component {...(props as any)} />
      </ConvexProvider>
    );
  };
}
