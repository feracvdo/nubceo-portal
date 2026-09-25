import Head from "next/head";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/favicon-192.png" type="image/png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/favicon-192.png" />
        <meta name="theme-color" content="#0a6bf4" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
