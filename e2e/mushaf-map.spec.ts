import { test, expect } from '@playwright/test'

test('published Qudratullah map is exact and complete', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' })
  const response = await page.request.get(new URL('data/mushaf/page-map.json', page.url()).toString())
  expect(response.ok()).toBeTruthy()
  const payload = await response.json()
  expect(payload.layout).toBe('Indopak 15 lines - Qudratullah')
  expect(payload.source).toBe('https://qul.tarteel.ai/mushaf_layouts/6')
  expect(payload.pages).toHaveLength(610)

  const pages = payload.pages as Array<{ page:number; from:string; to:string }>
  expect(pages[0]).toMatchObject({ page:1, from:'1:1', to:'1:7' })
  expect(pages[1]).toMatchObject({ page:2, from:'2:1', to:'2:4' })
  expect(pages[2]).toMatchObject({ page:3, from:'2:5', to:'2:15' })
  expect(pages[47]).toMatchObject({ page:48, from:'2:282', to:'2:282' })
  expect(pages[48]).toMatchObject({ page:49, from:'2:283', to:'2:286' })
  expect(pages[601]).toMatchObject({ page:602, from:'92:19', to:'94:8' })
  expect(pages[609]).toMatchObject({ page:610, from:'113:1', to:'114:6' })

  for (let index=1; index<pages.length; index+=1) {
    expect(pages[index].page).toBe(index+1)
    expect(compareVerseKeys(pages[index-1].from,pages[index].from)).toBeLessThan(0)
    expect(compareVerseKeys(pages[index-1].to,pages[index].from)).toBeLessThan(0)
  }
})

function compareVerseKeys(a:string,b:string) {
  const [ac,av]=a.split(':').map(Number)
  const [bc,bv]=b.split(':').map(Number)
  return (ac-bc)||(av-bv)
}
