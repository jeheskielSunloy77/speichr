import { Notification } from 'electron'

import type { NotificationPublisher } from '../../application/ports'

export class DesktopNotificationPublisher implements NotificationPublisher {
  public async notify(alert: {
    title: string
    message: string
  }): Promise<void> {
    try {
      if (!Notification.isSupported()) {
        return
      }

      const notification = new Notification({
        title: alert.title,
        body: alert.message,
      })

      notification.show()
    } catch (error) {
      void error
    }
  }
}
