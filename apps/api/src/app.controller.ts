import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get("healthz")
  healthCheck(): { status: "ok" } {
    return { status: "ok" };
  }
}
