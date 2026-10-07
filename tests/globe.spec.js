import {test,expect} from '@playwright/test';
test('globe, timelines, continent navigation, and satellite imagery work',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.waitForFunction(()=>window.pangea?.ready);await expect(page.locator('#status')).toBeEmpty();
 await page.waitForFunction(()=>window.pangea.viewer.scene.globe.tilesLoaded);await page.screenshot({path:'.qa/desktop.png'});
 expect(await page.evaluate(()=>window.pangea.viewer.imageryLayers.length)).toBe(1);
 await page.getByRole('button',{name:'260 million years ago',exact:false}).click();await page.waitForFunction(()=>window.pangea.age===260&&window.pangea.ready);await expect(page.locator('#age-hero')).toHaveText('260');
 await page.getByRole('searchbox').fill('Australia');await expect(page.locator('.place')).toHaveCount(1);await page.locator('.place').click();await expect(page.locator('#selection-name')).toHaveText('Australia');
 await page.waitForTimeout(1800);const before=await page.evaluate(()=>window.pangea.viewer.camera.positionCartographic.height);await page.getByRole('button',{name:'Zoom in',exact:true}).click();expect(await page.evaluate(()=>window.pangea.viewer.camera.positionCartographic.height)).toBeLessThan(before);
 await page.evaluate(()=>window.pangea.viewer.camera.setView({destination:Cesium.Cartesian3.fromDegrees(4.247,-27.2776,20000)}));await page.waitForFunction(()=>window.pangea.viewer.scene.globe.tilesLoaded);await page.screenshot({path:'.qa/deep-zoom.png'});
 await page.locator('#grid-toggle').check();await page.locator('#labels-toggle').uncheck();
 await page.getByRole('button',{name:'Satellite today',exact:true}).click();await page.waitForFunction(()=>window.pangea.mode==='modern'&&window.pangea.ready);
 await page.getByRole('button',{name:'View whole globe',exact:true}).click();await page.waitForTimeout(2200);await page.waitForFunction(()=>window.pangea.viewer.scene.globe.tilesLoaded);await expect(page.locator('#status')).toBeEmpty();await page.screenshot({path:'.qa/satellite.png'});
 await page.getByRole('button',{name:'Ancient geography',exact:true}).click();await page.waitForFunction(()=>window.pangea.age===260&&window.pangea.ready);
 await page.getByRole('button',{name:'About the map',exact:false}).click();await expect(page.locator('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('dialog')).not.toBeVisible();expect(errors).toEqual([]);
});
test('mobile exploration is usable',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/');await page.waitForFunction(()=>window.pangea?.ready);await page.waitForFunction(()=>window.pangea.viewer.scene.globe.tilesLoaded);await page.screenshot({path:'.qa/mobile.png'});await page.getByRole('button',{name:'Toggle exploration panel'}).click();await expect(page.locator('.explorer')).toBeVisible();await page.getByRole('searchbox').fill('India');await page.locator('.place').click();await expect(page.locator('#selection-name')).toHaveText('India');await expect(page.locator('.explorer')).not.toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);});
