#include <future>
#include <iostream>

int main() {
  std::future<int> result;
  {
    std::promise<int> producer;
    result = producer.get_future();
  }

  bool is_broken_promise = false;
  try {
    static_cast<void>(result.get());
  } catch (const std::future_error& error) {
    is_broken_promise =
        error.code() == std::make_error_code(std::future_errc::broken_promise);
  }

  std::cout << std::boolalpha;
  std::cout << "broken_promise=" << is_broken_promise << '\n';
  std::cout << "valid_after_get=" << result.valid() << '\n';
}
