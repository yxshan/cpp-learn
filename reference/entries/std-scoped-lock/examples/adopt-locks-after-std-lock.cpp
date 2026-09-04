#include <iostream>
#include <mutex>

int main() {
  std::mutex left_mutex;
  std::mutex right_mutex;
  int left = 0;
  int right = 0;

  std::lock(left_mutex, right_mutex);
  {
    std::scoped_lock lock(std::adopt_lock, left_mutex, right_mutex);
    left = 3;
    right = 4;
  }

  std::cout << "left=" << left << '\n';
  std::cout << "right=" << right << '\n';
}
