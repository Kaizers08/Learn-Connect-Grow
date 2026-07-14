import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  // Single toggle for the staging watermark.
  readonly showDemoWatermark = true;

  private bannerObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;

    const banner = document.querySelector('.demo-watermark-banner') as HTMLElement | null;
    if (!banner) return;

    const updateBannerHeight = () => {
      document.documentElement.style.setProperty('--demo-banner-height', `${banner.offsetHeight}px`);
    };

    updateBannerHeight();
    this.bannerObserver = new ResizeObserver(updateBannerHeight);
    this.bannerObserver.observe(banner);
  }

  ngOnDestroy(): void {
    this.bannerObserver?.disconnect();
  }
}
