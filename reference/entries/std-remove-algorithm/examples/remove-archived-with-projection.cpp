#include <algorithm>
#include <iostream>
#include <vector>

struct Task {
  int id;
  bool archived;
};

int main() {
  std::vector tasks{Task{1, false}, Task{2, true}, Task{3, false},
                    Task{4, true}};
  const auto removed =
      std::ranges::remove(tasks, true, &Task::archived);
  const auto kept = removed.begin() - tasks.begin();
  tasks.erase(removed.begin(), removed.end());

  std::cout << "kept=" << kept << '\n';
  std::cout << "ids=";
  for (std::size_t index = 0; index < tasks.size(); ++index) {
    std::cout << (index == 0 ? "" : ",") << tasks[index].id;
  }
  std::cout << '\n';
}
