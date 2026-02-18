import type { ConnectionProfile } from '../../../shared/contracts/cache'
import type {
  CacheGateway,
  ConnectionRepository,
  EngineEventIngestor,
  EngineTimelineEventInput,
  SecretStore,
} from '../../application/ports'

const DEFAULT_POLL_INTERVAL_MS = 5000
const DEFAULT_POLL_LIMIT = 64

export class ProviderEngineEventIngestor implements EngineEventIngestor {
  private onEvent: ((event: EngineTimelineEventInput) => Promise<void>) | null = null

  private running = false

  private workers: Promise<void>[] = []

  public constructor(
    private readonly connectionRepository: ConnectionRepository,
    private readonly secretStore: SecretStore,
    private readonly cacheGateway: CacheGateway,
    private readonly options?: {
      pollIntervalMs?: number
      pollLimit?: number
    },
  ) {}

  public async start(args: {
    onEvent: (event: EngineTimelineEventInput) => Promise<void>
  }): Promise<void> {
    this.onEvent = args.onEvent

    if (this.running) {
      return
    }

    this.running = true
    const profiles = await this.connectionRepository.list()
    const workers: Promise<void>[] = []
    for (const profile of profiles) {
      const capabilities = this.cacheGateway.getCapabilities(profile)
      if (capabilities.supportsMonitorStream || capabilities.supportsSlowLog) {
        workers.push(this.runProfilePollLoop(profile))
      }
    }

    this.workers = workers
  }

  public async stop(): Promise<void> {
    this.running = false
    const workers = this.workers
    this.workers = []
    await Promise.allSettled(workers)
    this.onEvent = null
  }

  private async runProfilePollLoop(
    profile: ConnectionProfile,
  ): Promise<void> {
    let cursor: string | undefined

    while (this.running) {
      const onEvent = this.onEvent
      if (!onEvent) {
        return
      }

      try {
        const secret = await this.secretStore.getSecret(profile.id)
        const result = await this.cacheGateway.pollEngineEvents(profile, secret, {
          cursor,
          limit: Math.max(1, this.options?.pollLimit ?? DEFAULT_POLL_LIMIT),
        })

        cursor = result.nextCursor ?? cursor
        for (const event of result.events) {
          if (!this.running || !this.onEvent) {
            return
          }

          await this.onEvent(event)
        }
      } catch (error) {
        void error
      }

      await this.delay(this.options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, Math.max(1, ms))
    })
  }
}
