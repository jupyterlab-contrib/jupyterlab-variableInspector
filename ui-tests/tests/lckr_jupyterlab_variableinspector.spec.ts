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
