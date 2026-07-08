import dynamic from "next/dynamic";
import Head from "next/head";

// El portal es 100% cliente (usa FileReader, clipboard, etc.)
const PortalApp = dynamic(() => import("../components/PortalApp"), { ssr: false });

export default function Home() {
  return (
    <>
      <Head>
        <title>Portal de implementación · Nubceo</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <PortalApp />
    </>
  );
}
