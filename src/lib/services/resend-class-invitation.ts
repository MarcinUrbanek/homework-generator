import { Resend } from "resend";

const INVITATION_VALIDITY_DAYS = 7;

export type ResendClassInvitationErrorCode = "PROVIDER_FAILURE";

export class ResendClassInvitationError extends Error {
  readonly code: ResendClassInvitationErrorCode;

  constructor(code: ResendClassInvitationErrorCode) {
    super(code);
    this.name = "ResendClassInvitationError";
    this.code = code;
  }
}

export interface ResendClassInvitationConfig {
  apiKey: string;
  fromEmail: string;
  appOrigin: string;
}

export interface ResendClassInvitationRequest {
  className: string;
  recipientEmail: string;
  token: string;
}

export interface ResendEmailClient {
  emails: {
    send: (message: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      text: string;
    }) => Promise<{ data: { id: string } | null; error: unknown }>;
  };
}

export interface ResendClassInvitationDependencies {
  client?: ResendEmailClient;
  clock?: () => Date;
  createClient?: (apiKey: string) => ResendEmailClient;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function invitationUrl(appOrigin: string, token: string): string {
  const url = new URL("/classes/join", appOrigin);
  url.searchParams.set("token", token);
  return url.toString();
}

function formatExpiry(clock: () => Date): string {
  const expiry = new Date(clock().getTime() + INVITATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "long", timeZone: "UTC" }).format(expiry);
}

function createResendClient(apiKey: string): ResendEmailClient {
  const ResendClientConstructor = Resend as unknown as new (apiKey: string) => ResendEmailClient;
  return new ResendClientConstructor(apiKey);
}

export async function sendResendClassInvitation(
  request: ResendClassInvitationRequest,
  config: ResendClassInvitationConfig,
  dependencies: ResendClassInvitationDependencies = {},
): Promise<{ providerMessageId: string }> {
  const client: ResendEmailClient =
    dependencies.client ?? dependencies.createClient?.(config.apiKey) ?? createResendClient(config.apiKey);
  const clock = dependencies.clock ?? (() => new Date());
  const url = invitationUrl(config.appOrigin, request.token);
  const escapedClassName = escapeHtml(request.className);
  const subjectClassName = request.className.replace(/[\r\n]+/g, " ");
  const escapedUrl = escapeHtml(url);
  const expiry = formatExpiry(clock);

  try {
    const result = await client.emails.send({
      from: config.fromEmail,
      to: [request.recipientEmail],
      subject: `Zaproszenie do klasy ${subjectClassName}`,
      text: [
        `Zapraszamy do klasy ${request.className}.`,
        `Otwórz zaproszenie: ${url}`,
        `Zaproszenie jest ważne do ${expiry}.`,
      ].join("\n\n"),
      html: [
        `<p>Zapraszamy do klasy <strong>${escapedClassName}</strong>.</p>`,
        `<p><a href="${escapedUrl}">Otwórz zaproszenie</a></p>`,
        `<p>Zaproszenie jest ważne do ${escapeHtml(expiry)}.</p>`,
      ].join(""),
    });

    if (result.error || !result.data?.id) {
      throw new ResendClassInvitationError("PROVIDER_FAILURE");
    }
    return { providerMessageId: result.data.id };
  } catch (error) {
    if (error instanceof ResendClassInvitationError) {
      throw error;
    }
    throw new ResendClassInvitationError("PROVIDER_FAILURE");
  }
}
