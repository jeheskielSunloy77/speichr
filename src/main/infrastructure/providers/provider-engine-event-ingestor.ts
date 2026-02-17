import type {
  CacheGateway,
  ConnectionRepository,
  EngineEventIngestor,
  EngineTimelineEventInput,
} from '../../application/ports'

export class ProviderEngineEventIngestor implements EngineEventIngestor {
  private onEvent: ((event: EngineTimelineEventInput) => Promise<void>) | null = null

  public constructor(
    private readonly connectionRepository: ConnectionRepository,
    private readonly cacheGateway: CacheGateway,
  ) {}

  public async start(args: {
    onEvent: (event: EngineTimelineEventInput) => Promise<void>
  }): Promise<void> {
    this.onEvent = args.onEvent

    const profiles = await this.connectionRepository.list()
    for (const profile of profiles) {
      const capabilities = this.cacheGateway.getCapabilities(profile)
      if (capabilities.supportsMonitorStream || capabilities.supportsSlowLog) {
        // Placeholder: provider-level event subscriptions are wired in follow-up work.
      }
    }
  }

  public async stop(): Promise<void> {
    this.onEvent = null
  }
}
