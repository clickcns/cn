import { Module } from "@nestjs/common";
import { ConfigService } from "../config/index.js";
import { LlmClient } from "../llm/llm.client.js";
import { SttClient } from "../speech/stt.client.js";
import { VisitModule } from "../visit/visit.module.js";
import { DictationController } from "./dictation.controller.js";
import { DictationPipeline } from "./dictation.pipeline.js";
import { DictationService } from "./dictation.service.js";

@Module({
  imports: [VisitModule],
  controllers: [DictationController],
  providers: [
    {
      provide: SttClient,
      useFactory: (config: ConfigService) =>
        new SttClient(config.speech.STT_GRPC_URL),
      inject: [ConfigService],
    },
    {
      provide: LlmClient,
      useFactory: (config: ConfigService) => {
        const env = config.speech;
        return new LlmClient({
          baseUrl: env.LLM_BASE_URL,
          apiKey: env.LLM_API_KEY,
          model: env.LLM_MODEL,
          reasoningEffort: env.LLM_REASONING_EFFORT,
        });
      },
      inject: [ConfigService],
    },
    {
      provide: DictationPipeline,
      useFactory: (stt: SttClient, llm: LlmClient) =>
        new DictationPipeline(stt, llm),
      inject: [SttClient, LlmClient],
    },
    DictationService,
  ],
})
export class DictationModule {}
