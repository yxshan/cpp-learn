#include <future>
#include <iostream>

int add_values(int left, int right) {
  return left + right;
}

int main() {
  std::packaged_task<int(int, int)> add(add_values);
  std::future<int> result = add.get_future();

  add(19, 23);
  std::cout << "result=" << result.get() << '\n';
}
