import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tmp-demo-user")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-tmp") !== "c7f2a9e1-demo-rename") return new Response("no", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById("5f13142b-205d-4f2f-bbb5-7b62b6466b2e", {
          email: "demo@gmail.com",
          password: "87186233",
          email_confirm: true,
        });
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ email: data.user.email });
      },
    },
  },
});
