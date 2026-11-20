import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { connect, Socket } from "net";
import { connect as connectTls } from "tls";
import {
  mailTlsOptions,
  masterAuth,
} from "../../mail/services/mail-connection";
import { VacationResponderDto } from "../dto/vacation.dto";

const quote = (value: string) =>
  `"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]/g, " ")}"`;
export function vacationScript(
  email: string,
  dto: VacationResponderDto,
): string {
  if (
    dto.startDate &&
    dto.endDate &&
    new Date(dto.startDate) >= new Date(dto.endDate)
  )
    throw new BadRequestException("End date must follow start date");
  const tests: string[] = [];
  const date = (value: string) =>
    new Date(value).toISOString().replace(/\.\d{3}Z$/, "+00:00");
  if (dto.startDate)
    tests.push(
      `currentdate :zone "+0000" :value "ge" "iso8601" ${quote(date(dto.startDate))}`,
    );
  if (dto.endDate)
    tests.push(
      `currentdate :zone "+0000" :value "lt" "iso8601" ${quote(date(dto.endDate))}`,
    );
  const text = dto.body.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
  const vacation = `vacation :days 1 :addresses [${quote(email)}] :subject ${quote(dto.subject)} text:\r\n${text}\r\n.\r\n;`;
  return `require ["vacation", "date", "relational"];\r\n${tests.length ? `if allof (${tests.join(", ")}) {\r\n${vacation}\r\n}` : vacation}\r\n`;
}

function response(socket: Socket, command?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const done = (error?: Error) => {
      clearTimeout(timer);
      socket.off("data", data);
      socket.off("error", fail);
      socket.off("close", close);
      if (error) reject(error);
      else resolve(buffer);
    };
    const fail = (error: Error) => done(error);
    const close = () => done(new Error("ManageSieve closed the connection"));
    const data = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      if (buffer.length > 65536)
        return done(new Error("ManageSieve response exceeds limit"));
      const terminal = buffer.match(/(?:^|\r\n)(OK|NO|BYE)(?:[^\r\n]*)\r\n/);
      if (terminal)
        done(
          terminal[1] === "OK"
            ? undefined
            : new Error("ManageSieve rejected the operation"),
        );
    };
    const timer = setTimeout(
      () => done(new Error("ManageSieve timeout")),
      10000,
    );
    socket.on("data", data);
    socket.once("error", fail);
    socket.once("close", close);
    if (command) socket.write(command + "\r\n");
  });
}

@Injectable()
export class SieveService {
  async setVacation(email: string, dto: VacationResponderDto): Promise<void> {
    const script = vacationScript(email, dto);
    let socket: Socket = connect({
      host: process.env.DOVECOT_HOST || "dovecot",
      port: Number(process.env.DOVECOT_SIEVE_PORT || 4190),
    });
    socket.on("error", () => {});
    try {
      await response(socket);
      await response(socket, "STARTTLS");
      socket = connectTls({ socket, ...mailTlsOptions() });
      socket.on("error", () => {});
      await response(socket);
      const auth = masterAuth(email);
      const credentials = Buffer.from(`\0${auth.user}\0${auth.pass}`).toString(
        "base64",
      );
      await response(socket, `AUTHENTICATE "PLAIN" "${credentials}"`);
      const scripts = await response(socket, "LISTSCRIPTS");
      const otherActive = scripts
        .split("\r\n")
        .some(
          (line) =>
            / ACTIVE$/.test(line) && !line.startsWith('"mailhive-vacation"'),
        );
      if (otherActive)
        throw new ConflictException(
          "Another Sieve script is active. Disable it before using the vacation responder.",
        );
      if (dto.isActive) {
        await response(
          socket,
          `PUTSCRIPT "mailhive-vacation" {${Buffer.byteLength(script)}+}\r\n${script}`,
        );
        await response(socket, 'SETACTIVE "mailhive-vacation"');
      } else {
        await response(socket, 'SETACTIVE ""');
      }
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new ServiceUnavailableException(
        "Could not apply vacation settings to the mail server",
      );
    } finally {
      socket.destroy();
    }
  }
}
