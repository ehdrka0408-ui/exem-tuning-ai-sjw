/**
 * CSS zoom-safe viewport dimensions.
 *
 * body { zoom: 1.1 } 일 때 window.innerWidth/Height는 물리 뷰포트 크기를 반환하지만,
 * fixed 요소의 CSS px은 zoom 배율만큼 확대되므로 overflow가 발생한다.
 * 이 함수는 zoom으로 나눈 "CSS 유효 뷰포트"를 반환한다.
 */
export function getViewport() {
  const zoom =
    parseFloat(getComputedStyle(document.body).zoom as string) ||
    parseFloat(getComputedStyle(document.documentElement).zoom as string) ||
    1
  return {
    w: window.innerWidth / zoom,
    h: window.innerHeight / zoom,
  }
}
