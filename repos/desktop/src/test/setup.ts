import '@testing-library/jest-dom/vitest';

class TestResizeObserver implements ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

globalThis.ResizeObserver = TestResizeObserver;
HTMLElement.prototype.hasPointerCapture = () => false;
HTMLElement.prototype.setPointerCapture = () => undefined;
HTMLElement.prototype.releasePointerCapture = () => undefined;
HTMLElement.prototype.scrollIntoView = () => undefined;