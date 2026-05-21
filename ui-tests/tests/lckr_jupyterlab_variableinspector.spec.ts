import { expect, test } from '@jupyterlab/galata';

const createAndRunNotebook = async (
  page: any,
  firstCell: string,
  secondCell: string
) => {
  await page.notebook.createNew();
  await page.notebook.setCell(0, 'code', firstCell);
  await page.notebook.addCell('code', secondCell);
  await page.notebook.runCell(0);
  await page.notebook.runCell(1);
};

const openVariableInspector = async (page: any) => {
  await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (window as any).jupyterapp.commands.execute('variableinspector:open');
  });
  await page.locator('.jp-VarInspector').first().waitFor({ state: 'visible' });
};

test('test', async ({ page }) => {
  test.setTimeout(120000);
  await createAndRunNotebook(page, 'a = 1', 'b = "hello"');
  await openVariableInspector(page);

  // const rows = await page.locator('.jp-VarInspector-table-row');

  const firstRow = await page.locator('.jp-VarInspector-table-row').first();
  await expect
    .soft(firstRow.locator('.jp-VarInspector-varName'))
    .toHaveText(/a/);
  await expect
    .soft(firstRow.locator('.jp-VarInspector-type'))
    .toHaveText(/int/);
  await expect
    .soft(firstRow.locator('jp-data-grid-cell').nth(4))
    .toHaveText(/\d\d/);
  await expect
    .soft(firstRow.locator('jp-data-grid-cell').last())
    .toHaveText(/1/);
  const secondRow = await page.locator('.jp-VarInspector-table-row').last();
  await expect
    .soft(secondRow.locator('.jp-VarInspector-varName'))
    .toHaveText(/b/);
  await expect
    .soft(secondRow.locator('.jp-VarInspector-type'))
    .toHaveText(/str/);
  await expect
    .soft(secondRow.locator('jp-data-grid-cell').nth(4))
    .toHaveText(/\d\d/);
  await expect
    .soft(secondRow.locator('jp-data-grid-cell').last())
    .toHaveText(/hello/);
});

test('variable filter', async ({ page }) => {
  test.setTimeout(120000);
  await createAndRunNotebook(page, 'a1 = 1', 'b1 = "hello"');
  await openVariableInspector(page);

  //Filter out rows with int type
  await page.locator('.filter-input').pressSequentially('int');
  await page.locator('.filter-button').click();

  //expect.soft only to have one row with name b and type str
  await expect
    .soft(await page.locator('.jp-VarInspector-table-row').count())
    .toEqual(1);
  const bRow = await page.locator('.jp-VarInspector-table-row').first();
  await expect.soft(bRow.locator('.jp-VarInspector-varName')).toHaveText(/b1/);
  await expect.soft(bRow.locator('.jp-VarInspector-type')).toHaveText(/str/);
  await expect
    .soft(bRow.locator('jp-data-grid-cell').nth(4))
    .toHaveText(/\d\d/);
  await expect
    .soft(bRow.locator('jp-data-grid-cell').last())
    .toHaveText(/hello/);

  // Remove filter
  await page.locator('.filtered-variable-button').click();

  //Filter out all variables with 1 in the name
  await page.evaluate('document.querySelector(".filter-type").value="name"');
  await page.locator('.filter-input').pressSequentially('*1');
  await page.locator('.filter-button').click();

  //expect.softs no rows except for header
  await expect
    .soft(await page.locator('.jp-VarInspector-table-row').count())
    .toEqual(0);

  //Remove the filter
  await page.locator('.filtered-variable-button').click();
  await expect
    .soft(await page.locator('.jp-VarInspector-table-row').count())
    .toEqual(2);

  //Filter out variables name b1
  await page.locator('.filter-input').pressSequentially('b1');
  await page.locator('.filter-button').click();

  //expect.soft one row with name a1 and type int
  await expect
    .soft(await page.locator('.jp-VarInspector-table-row').count())
    .toEqual(1);
  const aRow = await page.locator('.jp-VarInspector-table-row').first();
  await expect.soft(aRow.locator('.jp-VarInspector-varName')).toHaveText(/a1/);
  await expect.soft(aRow.locator('.jp-VarInspector-type')).toHaveText(/int/);
  await expect
    .soft(aRow.locator('jp-data-grid-cell').nth(4))
    .toHaveText(/\d\d/);
  await expect.soft(aRow.locator('jp-data-grid-cell').last()).toHaveText(/1/);
});
