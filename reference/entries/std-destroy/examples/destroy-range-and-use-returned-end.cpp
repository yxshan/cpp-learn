#include <iostream>
#include <memory>

struct Tracker {
  explicit Tracker(int* destroyed) noexcept : destroyed(destroyed) {}

  ~Tracker() noexcept {
    ++*destroyed;
  }

  int* destroyed;
};

int main() {
  int destroyed = 0;
  std::allocator<Tracker> allocator;
  Tracker* trackers = allocator.allocate(2);

  std::construct_at(trackers, &destroyed);
  std::construct_at(trackers + 1, &destroyed);

  Tracker* end = std::ranges::destroy(trackers, trackers + 2);
  std::cout << "returned=" << end - trackers << '\n';
  std::cout << "destroyed=" << destroyed << '\n';

  allocator.deallocate(trackers, 2);
}
