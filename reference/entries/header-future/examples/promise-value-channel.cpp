#include <future>
#include <iostream>
#include <thread>
#include <utility>

void publish(std::promise<int> output) {
  output.set_value(42);
}

int main() {
  std::promise<int> channel;
  std::future<int> answer = channel.get_future();

  std::thread producer(publish, std::move(channel));

  const int value = answer.get();
  producer.join();
  std::cout << "value=" << value << '\n';
}
