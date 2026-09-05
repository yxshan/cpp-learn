#include <future>
#include <iostream>
#include <string>

int main() {
  std::promise<std::string> producer;
  std::future<std::string> result = producer.get_future();
  producer.set_value("ready");

  std::cout << std::boolalpha;
  std::cout << "before=" << result.valid() << '\n';
  std::cout << "value=" << result.get() << '\n';
  std::cout << "after=" << result.valid() << '\n';
}
