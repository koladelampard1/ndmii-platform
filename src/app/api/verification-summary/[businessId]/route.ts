export async function GET() {
  return new Response("Secure credential token required", { status: 410 });
}
