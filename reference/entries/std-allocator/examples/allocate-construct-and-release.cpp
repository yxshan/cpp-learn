#include <iostream>
#include <memory>

struct Record {
  explicit Record(int value) noexcept : value(value) {}
  int value;
};

int main() {
  std::allocator<Record> allocator;
  Record* records = allocator.allocate(2);

  std::construct_at(records, 7);
  std::construct_at(records + 1, 9);

  std::cout << "values=" << records[0].value << ',' << records[1].value
            << '\n';

  std::destroy_n(records, 2);
  allocator.deallocate(records, 2);
}
