import { describe, expect, it } from "vitest";
import { parseSftpTestBody, SftpTestError } from "./sftpTest";

describe("parseSftpTestBody", () => {
  it("accepte un corps complet et normalise remoteDir vide en null", () => {
    const out = parseSftpTestBody({
      host: "sftp.example.com",
      port: 2022,
      user: "world",
      password: "pw",
      remoteDir: "",
    });
    expect(out).toEqual({
      host: "sftp.example.com",
      port: 2022,
      user: "world",
      password: "pw",
      remoteDir: null,
    });
  });

  it("rejette un corps incomplet", () => {
    expect(() => parseSftpTestBody({ host: "h" })).toThrow(SftpTestError);
  });

  it("rejette un port non entier", () => {
    expect(() =>
      parseSftpTestBody({ host: "h", port: "22", user: "u", password: "p", remoteDir: null }),
    ).toThrow(SftpTestError);
  });
});
