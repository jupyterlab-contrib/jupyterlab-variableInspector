import { expect, test } from '@jupyterlab/galata';

test('test', async ({ page }) => {
  await page.getByText('Python 3 (ipykernel)').first().click();
  await page.getByText('Python 3 (ipykernel) | Idle').waitFor();
  await page.getByLabel('notebook content').getByRole('textbox').fill('a = 1');
  await page.keyboard.press('Shift+Enter');
  await page.getByRole('textbox').nth(2).fill('b = "hello"');
  await page.keyboard.press('Control+Enter');

  await page.getByRole('tabpanel').click({
    button: 'right'
  });
  await page.getByRole('menu').getByText('Open Variable Inspector').click();

  await expect(page.getByRole('row').nth(1)).toHaveText(/aint\d\d1$/);
  await expect(page.getByRole('row').last()).toHaveText(/bstr\d\dhello$/);
});

test('variable filter by type', async ({ page }) => {
  await page.getByText('Python 3 (ipykernel)').first().click();
  await page.getByText('Python 3 (ipykernel) | Idle').waitFor();
  await page.getByLabel('notebook content').getByRole('textbox').fill('a = 1');
  await page.keyboard.press('Shift+Enter');
  await page.getByRole('textbox').nth(2).fill('b = "hello"');
  await page.keyboard.press('Control+Enter');

  await page.getByRole('tabpanel').click({
    button: 'right'
  });
  await page.getByRole('menu').getByText('Open Variable Inspector').click();

  //Filter out rows with int type
  await page.getByPlaceholder('Filter out variable').fill('int');
  await page.getByRole('button', { name: 'Filter' }).click();

  //Expect only to have one row with name b and type str
  await expect(
    await page.locator('.jp-VarInspector-table-row').count()
  ).toEqual(1);
  await expect(page.getByRole('row').nth(1)).toHaveText(/bstr\d\dhello$/);
});

test('variable filter by name', async ({ page }) => {
  await page.getByText('Python 3 (ipykernel)').first().click();
  await page.getByText('Python 3 (ipykernel) | Idle').waitFor();
  await page.getByLabel('notebook content').getByRole('textbox').fill('a1 = 1');
  await page.keyboard.press('Shift+Enter');
  await page.getByRole('textbox').nth(2).fill('b1 = "hello"');
  await page.keyboard.press('Control+Enter');

  await page.getByRole('tabpanel').click({
    button: 'right'
  });
  await page.getByRole('menu').getByText('Open Variable Inspector').click();

  //Filter out all variables with 1 in the name
  await page.locator('.filter-type').selectOption('name');
  await page.getByPlaceholder('Filter out variable').fill('*1');
  await page.getByRole('button', { name: 'Filter' }).click();

  //Expects no rows except for header
  await expect(await page.getByRole('row').count()).toEqual(1);
  await expect(
    await page.locator('.jp-VarInspector-table-row').count()
  ).toEqual(0);

  //Remove the filter
  await page.getByRole('button', { name: '*' }).click();
  await expect(
    await page.locator('.jp-VarInspector-table-row').count()
  ).toEqual(2);

  //Filter out variables name b1
  await page.getByPlaceholder('Filter out variable').fill('b1');
  await page.getByRole('button', { name: 'Filter' }).click();

  //Expect one row with name a1 and type int
  await expect(
    await page.locator('.jp-VarInspector-table-row').count()
  ).toEqual(1);
  await expect(page.getByRole('row').nth(1)).toHaveText(/a1int\d\d1$/);
});
