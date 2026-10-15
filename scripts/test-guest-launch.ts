import { executeAction } from '../electron/executor'

async function main() {
  const result = await executeAction(
    {
      action: 'web_search',
      target: 'chrome',
      query: 'programming',
      source: 'local',
      rawText: 'open chrome and search programming',
    },
    { autoPaste: false },
  )
  console.log('executeAction →', JSON.stringify(result))
}

void main()
