import { executeAction } from '../electron/executor'

async function main() {
  const result = await executeAction(
    {
      action: 'send_message',
      target: 'whatsapp',
      query: 'Chayapathi',
      responseText: 'hello',
      source: 'local',
      rawText: 'open whatsapp and send a message to Chayapathi saying hello',
    },
    { autoPaste: true },
  )
  console.log('RESULT:', JSON.stringify(result))
}

void main()
