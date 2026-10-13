// Run with: NODE_PATH=/path/to/jsdom/node_modules node scripts/check-scroll-area-suspense.cjs
// If needed: npm install --prefix /tmp/feishin-dom-test jsdom --no-audit --no-fund
/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports, perfectionist/sort-imports */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const { JSDOM } = require('jsdom');
const React = require('react');
const ts = require('typescript');

const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
for (const key of ['document', 'Element', 'HTMLElement', 'MutationObserver', 'window']) {
    global[key] = dom.window[key];
}
global.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const { createPortal } = require('react-dom');
const { OverlayScrollbars } = require('overlayscrollbars');

const source = readFileSync('src/shared/components/scroll-area/scroll-area.tsx', 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: {
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
    },
}).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, {
    exports: exportsObject,
    require: (name) => {
        if (name.endsWith('.css')) return { __esModule: true, default: {} };
        if (name.includes('types/drag-and-drop')) return { DragTarget: { TABLE_COLUMN: 'column' } };
        if (name.includes('auto-scroll/element')) return { autoScrollForElements: () => () => {} };
        if (name.includes('use-merged-ref')) {
            return {
                useMergedRef:
                    (...refs) =>
                    (element) => {
                        for (const ref of refs) {
                            if (typeof ref === 'function') ref(element);
                            else if (ref) ref.current = element;
                        }
                    },
            };
        }
        return require(name);
    },
});
const { ScrollArea } = exportsObject;
const h = React.createElement;

// Negative control: automatic viewport generation moves the fallback away from
// the parent React will use when deleting it after a suspended query resolves.
const legacyHost = document.createElement('div');
const legacyFallback = document.createElement('div');
legacyHost.append(legacyFallback);
document.body.append(legacyHost);
const legacyInstance = OverlayScrollbars(legacyHost, {});
assert.notEqual(legacyFallback.parentNode, legacyHost);
assert.throws(() => legacyHost.removeChild(legacyFallback), { name: 'NotFoundError' });
legacyInstance.destroy();
legacyHost.remove();

(async () => {
    for (const page of ['albums', 'songs']) {
        const host = document.createElement('div');
        const sidebar = document.createElement('div');
        document.body.append(host, sidebar);
        const root = createRoot(host);
        let ready = false;
        let resolve;
        const pending = new Promise((done) => {
            resolve = done;
        });
        const Filters = () => {
            if (!ready) throw pending;
            return h('div', { 'data-filters': page }, 'artist and genre filters');
        };
        const render = (warm = false) =>
            createPortal(
                h(
                    ScrollArea,
                    null,
                    h(
                        React.Suspense,
                        { fallback: h('div', { 'data-loading': page }, 'loading') },
                        h(Filters, { warm }),
                    ),
                ),
                sidebar,
            );
        await React.act(async () => {
            root.render(render());
        });
        const fallback = sidebar.querySelector('[data-loading]');
        assert.ok(fallback, `${page}: cold fallback mounted`);
        const viewport = fallback.parentNode;
        assert.ok(viewport.hasAttribute('data-overlayscrollbars-viewport'));
        await React.act(async () => {
            ready = true;
            resolve();
            await pending;
        });
        assert.equal(sidebar.querySelector('[data-loading]'), null);
        assert.equal(sidebar.querySelector('[data-filters]').parentNode, viewport);
        await React.act(async () => {
            root.render(render(true));
        });
        assert.equal(sidebar.querySelector('[data-filters]').parentNode, viewport);
        await React.act(async () => {
            root.unmount();
        });
        assert.equal(sidebar.childElementCount, 0);
        host.remove();
        sidebar.remove();
    }
    dom.window.close();
    console.log(
        'ScrollArea: legacy failure reproduced; cold Suspense, warm update and portal unmount passed',
    );
})().catch((error) => {
    console.error(error);
    dom.window.close();
    process.exitCode = 1;
});
