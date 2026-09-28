import { describe, it, expect, vi, beforeEach } from 'vitest'

const createNotification = vi.fn()
vi.mock('@/lib/notifications', () => ({ createNotification: (...a: unknown[]) => createNotification(...a) }))

const { notifyStatusChanges, isNotifiableStatus } = await import('../customer-notify')

beforeEach(() => createNotification.mockReset())

describe('notifyStatusChanges (fix list 7.2)', () => {
  it('sends one grouped notification per user and status', async () => {
    await notifyStatusChanges([
      ...Array.from({ length: 12 }, () => ({ userId: 'u1', status: 'delivered' as const })),
      { userId: 'u1', status: 'dispatched' },
      { userId: 'u2', status: 'delivered' },
    ])

    expect(createNotification).toHaveBeenCalledTimes(3)
    const titles = createNotification.mock.calls.map(([n]) => `${n.userId}: ${n.title}`)
    expect(titles).toEqual(
      expect.arrayContaining(['u1: 12 postcards delivered', 'u1: 1 postcard dispatched', 'u2: 1 postcard delivered'])
    )
  })

  it('emails returned cards only', async () => {
    await notifyStatusChanges([
      { userId: 'u1', status: 'dispatched' },
      { userId: 'u1', status: 'delivered' },
      { userId: 'u1', status: 'returned' },
      { userId: 'u1', status: 'returned' },
    ])
    const byType = Object.fromEntries(createNotification.mock.calls.map(([n]) => [n.type, n]))
    expect(byType.postcard_dispatched.sendEmail).toBe(false)
    expect(byType.postcard_delivered.sendEmail).toBe(false)
    expect(byType.postcard_returned.sendEmail).toBe(true)
    expect(byType.postcard_returned.title).toBe('2 postcards returned')
    expect(byType.postcard_returned.body).toContain('deliver them')
  })

  it('never names the printer or the carrier, or uses a long dash', async () => {
    await notifyStatusChanges([
      { userId: 'u1', status: 'dispatched' },
      { userId: 'u1', status: 'delivered' },
      { userId: 'u1', status: 'returned' },
    ])
    for (const [n] of createNotification.mock.calls) {
      expect(`${n.title} ${n.body}`).not.toMatch(/royal mail|stannp|—/i)
    }
  })

  it('only notifies for dispatched, delivered and returned', () => {
    expect(['dispatched', 'delivered', 'returned'].every(isNotifiableStatus)).toBe(true)
    expect(['production', 'local_delivery', 'received', 'failed'].some(isNotifiableStatus)).toBe(false)
  })
})
