export async function sendViaConsole({ to, subject, html }) {
  console.info("[zhimu-email:console]", JSON.stringify({ to, subject, htmlLength: html?.length ?? 0 }));
}
