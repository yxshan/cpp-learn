#include <algorithm>
#include <array>
#include <iostream>

struct WorkItem {
  int id;
};

int main() {
  std::array queue{WorkItem{10}, WorkItem{20}, WorkItem{30}, WorkItem{40}};
  const auto result = std::ranges::rotate(queue, queue.begin() + 1);

  std::cout << "old_first_index=" << result.begin() - queue.begin() << '\n';
  std::cout << "values=";
  for (std::size_t index = 0; index < queue.size(); ++index) {
    std::cout << (index == 0 ? "" : ",") << queue[index].id;
  }
  std::cout << '\n';
}
