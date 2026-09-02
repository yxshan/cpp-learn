#include <iostream>
#include <memory>

struct Task {
  explicit Task(int id) noexcept : id(id) {}

  ~Task() noexcept {
    std::cout << "destroy=" << id << '\n';
  }

  int id;
};

int main() {
  std::allocator<Task> allocator;
  Task* tasks = allocator.allocate(3);

  std::construct_at(tasks, 1);
  std::construct_at(tasks + 1, 2);
  std::construct_at(tasks + 2, 3);

  std::destroy(tasks, tasks + 3);
  allocator.deallocate(tasks, 3);
}
